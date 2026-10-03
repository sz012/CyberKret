from collections import deque
from datetime import datetime, timedelta

from ..db import IncidentRecord
from ..schemas import (
    Action,
    ActivityState,
    Clock,
    ConfirmationState,
    Continuity,
    Hypothesis,
    Impact,
    ImpactService,
    Incident,
    IncidentSummary,
    IncidentType,
    LogEntry,
    Organization,
    PhaseProgress,
)
from ..text import plural
from . import playbook_payment_fraud as payment_fraud

PLAYBOOKS = {payment_fraud.TYPE_ID: payment_fraud}

INCIDENT_TYPES: tuple[IncidentType, ...] = (
    IncidentType(
        id=payment_fraud.TYPE_ID,
        label=payment_fraud.TYPE_LABEL,
        description=payment_fraud.TYPE_DESCRIPTION,
        available=True,
    ),
    IncidentType(
        id="mailbox_takeover",
        label="Podejrzenie przejęcia skrzynki",
        description="Ktoś loguje się na konto biura albo zmieniło się hasło.",
        available=False,
    ),
    IncidentType(
        id="service_down",
        label="Niedostępność kluczowej usługi",
        description="Program księgowy, poczta albo strona przestały działać.",
        available=False,
    ),
    IncidentType(
        id="account_lost",
        label="Utrata dostępu do konta",
        description="Nie możecie zalogować się do ważnego konta.",
        available=False,
    ),
    IncidentType(id="other", label="Coś innego", description="Inna sytuacja, która Was niepokoi.", available=False),
)
TYPE_LABELS = {t.id: t.label for t in INCIDENT_TYPES}
PRIORITY_ORDER = {"now": 0, "15min": 1, "30min": 2, "verify": 3}
PHASES = (
    ("stop", "Zatrzymaj"),
    ("assess", "Oceń"),
    ("notify", "Zawiadom"),
    ("continue", "Utrzymaj działanie"),
    ("learn", "Wnioski"),
)
UODO_HOURS = 72


def build_actions(
    answers: dict[str, str],
    hypotheses: list[Hypothesis],
    statuses: dict[str, str],
    org: Organization,
) -> list[Action]:
    context = payment_fraud.PlanContext(answers=answers, hypotheses={h.id: h.likelihood for h in hypotheses})
    order = {a.id: index for index, a in enumerate(payment_fraud.ACTIONS)}
    selected = [a for a in payment_fraud.ACTIONS if a.when(context)]
    selected.sort(key=lambda a: (PRIORITY_ORDER[a.priority], order[a.id]))
    return [
        Action(
            id=a.id,
            title=a.title.format(mailbox=org.mailbox, domain=org.domain),
            detail=a.detail,
            priority=a.priority,
            phase=a.phase,
            role=a.role,
            safe_any_cause=a.safe_any_cause,
            tag=a.tag,
            template=a.template,
            status=statuses.get(a.id, "todo"),
        )
        for a in selected
    ]


def build_impact(org: Organization) -> Impact:
    services = {s.id: s for s in org.services}
    untrusted_id = payment_fraud.UNTRUSTED_SERVICE
    dependents: dict[str, list] = {}
    for dependency in org.dependencies:
        if dependency.kind == "depends":
            dependents.setdefault(dependency.source, []).append(dependency)

    threatened: list[ImpactService] = []
    seen = {untrusted_id}
    queue = deque([untrusted_id])
    while queue:
        current = queue.popleft()
        for dependency in dependents.get(current, []):
            if dependency.target in seen:
                continue
            seen.add(dependency.target)
            queue.append(dependency.target)
            threatened.append(
                ImpactService(
                    service=dependency.target,
                    name=services[dependency.target].name,
                    reason=f"{services[current].name}: {dependency.label}",
                )
            )

    fallbacks: list[ImpactService] = []
    covered = set(seen)
    changed = True
    while changed:
        changed = False
        for dependency in org.dependencies:
            if dependency.kind != "fallback" or dependency.target not in covered or dependency.source in covered:
                continue
            covered.add(dependency.source)
            fallbacks.append(
                ImpactService(service=dependency.source, name=services[dependency.source].name, reason=dependency.label)
            )
            changed = True

    return Impact(
        untrusted=[
            ImpactService(
                service=untrusted_id,
                name=services[untrusted_id].name,
                reason="Nie wiemy jeszcze, kto ma do niej dostęp i kto wysyła maile w jej imieniu.",
            )
        ],
        threatened=threatened,
        unsafe=[
            f"Wszystko, co biuro wysyła z {org.mailbox}.",
            "Odpowiedzi klientów przychodzące na tę skrzynkę.",
            "Linki do resetu haseł, które trafiają do tej skrzynki.",
        ],
        fallbacks=fallbacks,
    )


def build_continuity(
    org: Organization,
    confirmations: dict[str, bool],
    impact: Impact,
    priority: str,
    is_open: bool,
) -> Continuity:
    affected = {s.service for s in impact.untrusted} | {s.service for s in impact.threatened}
    first = payment_fraud.PRIORITY_ACTIVITY.get(priority)
    activities = sorted(org.activities, key=lambda a: (a.id != first, not a.critical))
    states: list[ActivityState] = []
    missing = 0
    for activity in activities:
        items = [
            ConfirmationState(id=c.id, label=c.label, done=confirmations.get(c.id, False))
            for c in activity.confirmations
        ]
        all_done = all(item.done for item in items)
        if activity.critical:
            missing += sum(not item.done for item in items)
        if any(service in affected for service in activity.depends_on):
            if all_done:
                status = "fallback" if activity.fallback else "ok"
            else:
                status = "at_risk" if activity.critical else "paused"
        else:
            status = "ok" if all_done else "pending"
        states.append(
            ActivityState(
                id=activity.id,
                name=activity.name,
                note=activity.note,
                critical=activity.critical,
                status=status,
                normally=activity.normally,
                fallback=activity.fallback,
                confirmations=items,
            )
        )
    maintained = missing == 0
    if maintained:
        headline = org.continuity_ok
        detail = "E-mail biura pozostaje niezaufany." if is_open else "Incydent zamknięty."
    else:
        headline = "Działalność krytyczna nie jest jeszcze potwierdzona."
        detail = f"Brakuje {missing} {plural(missing, 'potwierdzenia', 'potwierdzeń', 'potwierdzeń')}."
    return Continuity(maintained=maintained, headline=headline, detail=detail, missing=missing, activities=states)


def build_clocks(record: IncidentRecord, answers: dict[str, str]) -> list[Clock]:
    if answers.get("Q6") != "yes":
        return []
    started = record.answered_at.get("Q6", record.created_at)
    due = datetime.fromisoformat(started) + timedelta(hours=UODO_HOURS)
    return [
        Clock(
            id="uodo",
            label="Zgłoszenie naruszenia do UODO",
            started_at=started,
            due_at=due.isoformat(timespec="seconds"),
        )
    ]


def build_phases(
    actions: list[Action], continuity: Continuity, lessons_done: int, lessons_total: int
) -> list[PhaseProgress]:
    progress = []
    for phase_id, label in PHASES:
        own = [a for a in actions if a.phase == phase_id]
        done = sum(a.status == "done" for a in own)
        total = len(own)
        if phase_id == "continue":
            critical = [c for a in continuity.activities if a.critical for c in a.confirmations]
            done += sum(c.done for c in critical)
            total += len(critical)
        if phase_id == "learn":
            done, total = lessons_done, lessons_total
        progress.append(PhaseProgress(id=phase_id, label=label, done=done, total=total))
    return progress


def evaluate(record: IncidentRecord, org: Organization, log: list[LogEntry]) -> Incident:
    answers = {**payment_fraud.defaults(), **record.answers}
    hypotheses = payment_fraud.hypotheses(answers, org)
    actions = build_actions(answers, hypotheses, record.action_status, org)
    impact = build_impact(org)
    is_open = record.status == "open"
    continuity = build_continuity(org, record.confirmations, impact, answers["Q5"], is_open)
    lessons = payment_fraud.lessons({h.id: h.likelihood for h in hypotheses}, org)
    lessons_done = sum(lesson.state == "present" for lesson in lessons)
    return Incident(
        id=record.id,
        type=record.type,
        type_label=TYPE_LABELS.get(record.type, record.type),
        status="open" if is_open else "closed",
        created_at=record.created_at,
        closed_at=record.closed_at,
        answers=answers,
        questions=payment_fraud.questions(org),
        facts=payment_fraud.facts(answers, record.facts, org),
        hypotheses=hypotheses,
        actions=actions,
        phases=build_phases(actions, continuity, lessons_done, len(lessons)),
        impact=impact,
        continuity=continuity,
        clocks=build_clocks(record, answers),
        lessons=lessons,
        log=log,
    )


def summarize(record: IncidentRecord, org: Organization) -> IncidentSummary:
    answers = {**payment_fraud.defaults(), **record.answers}
    hypotheses = payment_fraud.hypotheses(answers, org)
    actions = build_actions(answers, hypotheses, record.action_status, org)
    return IncidentSummary(
        id=record.id,
        type=record.type,
        type_label=TYPE_LABELS.get(record.type, record.type),
        status="open" if record.status == "open" else "closed",
        created_at=record.created_at,
        closed_at=record.closed_at,
        done=sum(a.status == "done" for a in actions),
        total=len(actions),
    )


def plan_diff(before: list[Action], after: list[Action]) -> tuple[list[str], list[str]]:
    before_ids = {a.id for a in before}
    after_ids = {a.id for a in after}
    added = [a.title for a in after if a.id not in before_ids]
    removed = [a.title for a in before if a.id not in after_ids]
    return added, removed
