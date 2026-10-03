from fastapi import APIRouter, HTTPException

from ..db import IncidentRecord, Store, now_iso
from ..deps import StoreDep
from ..incident import engine
from ..incident import playbook_payment_fraud as payment_fraud
from ..schemas import (
    ActionStatusUpdate,
    AnswersUpdate,
    ConfirmationUpdate,
    Incident,
    IncidentCatalog,
    IncidentCreate,
    IncidentSummary,
    LessonsApply,
    LessonsResult,
)
from ..text import plural
from .kret import dig_and_store

router = APIRouter(prefix="/api", tags=["incidents"])

STATUS_LABELS = {"todo": "do zrobienia", "in_progress": "w toku", "done": "zrobione"}
MAX_FACT_LENGTH = 300
DIFF_PREVIEW = 3


def _record(store: Store, incident_id: int) -> IncidentRecord:
    record = store.get_incident(incident_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Nie ma takiego incydentu.")
    return record


def _require_open(record: IncidentRecord) -> None:
    if record.status != "open":
        raise HTTPException(status_code=409, detail="Ten incydent jest już zamknięty.")


def _view(store: Store, record: IncidentRecord) -> Incident:
    log = store.list_log(incident_id=record.id, limit=200, newest_first=False)
    return engine.evaluate(record, store.get_org(), log)


def _steps(count: int) -> str:
    return f"{count} {plural(count, 'krok', 'kroki', 'kroków')}"


def _titles(titles: list[str]) -> str:
    shown = "; ".join(titles[:DIFF_PREVIEW])
    return f"{shown} i {len(titles) - DIFF_PREVIEW} więcej" if len(titles) > DIFF_PREVIEW else shown


def _diff_message(added: list[str], removed: list[str]) -> str:
    parts = [f"Plan zaktualizowany: +{_steps(len(added))}, -{_steps(len(removed))}."]
    if added:
        parts.append(f"Doszło: {_titles(added)}.")
    if removed:
        parts.append(f"Odpadło: {_titles(removed)}.")
    return " ".join(parts)


@router.get("/incident-types", response_model=IncidentCatalog)
def catalog(store: StoreDep) -> IncidentCatalog:
    return IncidentCatalog(
        types=list(engine.INCIDENT_TYPES),
        questions=payment_fraud.questions(store.get_org()),
        defaults=payment_fraud.defaults(),
    )


@router.post("/incidents", response_model=Incident, status_code=201)
def create_incident(body: IncidentCreate, store: StoreDep) -> Incident:
    if body.type not in engine.PLAYBOOKS:
        raise HTTPException(status_code=400, detail="Ten rodzaj zdarzenia jest jeszcze w przygotowaniu.")
    try:
        payment_fraud.validate_answers(body.answers)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    answers = {**payment_fraud.defaults(), **body.answers}
    facts = list(dict.fromkeys(fact.strip()[:MAX_FACT_LENGTH] for fact in body.facts if fact.strip()))
    org = store.get_org()
    incident_id = store.create_incident(org.id, body.type, answers, facts)
    store.log("incident_opened", f"Zgłoszono incydent: {engine.TYPE_LABELS[body.type]}.", incident_id)
    record = _record(store, incident_id)
    plan = engine.evaluate(record, org, []).actions
    urgent = sum(action.priority == "now" for action in plan)
    store.log("plan", f"Plan gotowy: {_steps(len(plan))}, w tym {urgent} od razu.", incident_id)
    return _view(store, record)


@router.get("/incidents", response_model=list[IncidentSummary])
def list_incidents(store: StoreDep) -> list[IncidentSummary]:
    org = store.get_org()
    return [engine.summarize(record, org) for record in store.list_incidents()]


@router.get("/incidents/{incident_id}", response_model=Incident)
def get_incident(incident_id: int, store: StoreDep) -> Incident:
    return _view(store, _record(store, incident_id))


@router.patch("/incidents/{incident_id}/answers", response_model=Incident)
def update_answers(incident_id: int, body: AnswersUpdate, store: StoreDep) -> Incident:
    record = _record(store, incident_id)
    _require_open(record)
    try:
        payment_fraud.validate_answers(body.answers)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    changed = {key: value for key, value in body.answers.items() if record.answers.get(key) != value}
    if not changed:
        return _view(store, record)

    org = store.get_org()
    before = engine.evaluate(record, org, []).actions
    stamp = now_iso()
    record.answers = {**record.answers, **changed}
    record.answered_at = {**record.answered_at, **dict.fromkeys(changed, stamp)}
    store.update_incident(incident_id, answers=record.answers, answered_at=record.answered_at)
    after = engine.evaluate(record, org, []).actions

    for question_id, value in changed.items():
        short = payment_fraud.QUESTION_INDEX[question_id].short
        label = payment_fraud.answer_label(question_id, value)
        store.log("fact", f"Nowy fakt. {short}: {label.lower()}.", incident_id)
    added, removed = engine.plan_diff(before, after)
    if added or removed:
        store.log("plan_diff", _diff_message(added, removed), incident_id)
    return _view(store, record)


@router.patch("/incidents/{incident_id}/actions/{action_id}", response_model=Incident)
def update_action(incident_id: int, action_id: str, body: ActionStatusUpdate, store: StoreDep) -> Incident:
    record = _record(store, incident_id)
    _require_open(record)
    action = payment_fraud.ACTION_INDEX.get(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Nie ma takiego kroku.")
    if record.action_status.get(action_id, "todo") == body.status:
        return _view(store, record)
    record.action_status = {**record.action_status, action_id: body.status}
    store.update_incident(incident_id, action_status=record.action_status)
    org = store.get_org()
    title = action.title.format(mailbox=org.mailbox, domain=org.domain)
    store.log("action", f"Krok „{title}”: {STATUS_LABELS[body.status]}.", incident_id)
    return _view(store, record)


@router.patch("/incidents/{incident_id}/confirmations/{item_id}", response_model=Incident)
def update_confirmation(incident_id: int, item_id: str, body: ConfirmationUpdate, store: StoreDep) -> Incident:
    record = _record(store, incident_id)
    _require_open(record)
    org = store.get_org()
    labels = {c.id: c.label for activity in org.activities for c in activity.confirmations}
    if item_id not in labels:
        raise HTTPException(status_code=404, detail="Nie ma takiego potwierdzenia.")
    if record.confirmations.get(item_id, False) == body.done:
        return _view(store, record)
    was_maintained = engine.evaluate(record, org, []).continuity.maintained
    record.confirmations = {**record.confirmations, item_id: body.done}
    store.update_incident(incident_id, confirmations=record.confirmations)
    prefix = "Potwierdzono" if body.done else "Cofnięto potwierdzenie"
    store.log("confirmation", f"{prefix}: {labels[item_id]}.", incident_id)
    continuity = engine.evaluate(record, org, []).continuity
    if continuity.maintained and not was_maintained:
        store.log("continuity", f"{continuity.headline} {continuity.detail}", incident_id)
    return _view(store, record)


@router.post("/incidents/{incident_id}/close", response_model=Incident)
def close_incident(incident_id: int, store: StoreDep) -> Incident:
    record = _record(store, incident_id)
    _require_open(record)
    record.status = "closed"
    record.closed_at = now_iso()
    store.update_incident(incident_id, status="closed", closed_at=record.closed_at)
    store.log("incident_closed", "Incydent zamknięty. Czas zasypać tunele.", incident_id)
    return _view(store, record)


@router.post("/incidents/{incident_id}/lessons/apply", response_model=LessonsResult)
def apply_lessons(incident_id: int, body: LessonsApply, store: StoreDep) -> LessonsResult:
    _record(store, incident_id)
    org = store.get_org()
    safeguards = {s.id: s for s in org.safeguards}
    if any(sid not in safeguards for sid in body.safeguards):
        raise HTTPException(status_code=400, detail="Nie ma takiego zabezpieczenia.")
    before = dig_and_store(store)
    applied = []
    for sid in dict.fromkeys(body.safeguards):
        safeguard = safeguards[sid]
        if safeguard.state != "present":
            safeguard.state = "present"
            safeguard.source = "answers"
            applied.append(sid)
    store.save_org(org)
    for sid in applied:
        store.log("safeguard", f"Zasypano tunel: {safeguards[sid].fix}.", incident_id)
    after = dig_and_store(store)
    store.log(
        "lessons", f"Kret sprawdził ponownie. Otwarte drogi: przed {before.total}, po {after.total}.", incident_id
    )
    return LessonsResult(applied=applied, before=before, after=after)
