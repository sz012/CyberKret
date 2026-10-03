from collections import defaultdict

from ..db import now_iso
from ..schemas import (
    KretMove,
    KretPath,
    KretPosition,
    KretResult,
    KretSegment,
    KretStep,
    KretStory,
    KretTarget,
    Organization,
    Safeguard,
    SafeguardRef,
)
from ..text import lower_first, plural
from .techniques import POSITIONS, TECHNIQUES, Technique

ENTRY = "internet"
MOVE_LIMIT = 3

Route = list[tuple[Technique, str]]


def _fill(text: str, org: Organization) -> str:
    return text.format(mailbox=org.mailbox, domain=org.domain)


def _applicable(technique: Technique, safeguards: dict[str, Safeguard]) -> bool:
    return all(sid in safeguards for sid in technique.requires)


def _active(technique: Technique, safeguards: dict[str, Safeguard]) -> bool:
    if not _applicable(technique, safeguards):
        return False
    return all(safeguards[sid].state != "present" for sid in technique.requires)


def find_paths(org: Organization) -> list[KretPath]:
    safeguards = {s.id: s for s in org.safeguards}
    active = [t for t in TECHNIQUES if _active(t, safeguards)]
    targets = {p.id for p in POSITIONS if p.kind == "target"}
    routes: list[Route] = []

    def dig(position: str, visited: frozenset[str], route: Route) -> None:
        for technique in active:
            if position not in technique.sources or technique.target in visited:
                continue
            extended = [*route, (technique, position)]
            if technique.target in targets:
                routes.append(extended)
            dig(technique.target, visited | {technique.target}, extended)

    dig(ENTRY, frozenset({ENTRY}), [])
    order = {p.id: index for index, p in enumerate(POSITIONS)}
    paths = [_to_path(route, safeguards, org) for route in routes]
    paths.sort(key=lambda path: (order[path.target], len(path.steps), path.id))
    return paths


def _to_path(route: Route, safeguards: dict[str, Safeguard], org: Organization) -> KretPath:
    steps = [
        KretStep(
            technique=technique.id,
            name=technique.name,
            source=source,
            target=technique.target,
            narrative=_fill(technique.narrative, org),
            requires=list(technique.requires),
            unknown=[sid for sid in technique.requires if safeguards[sid].state == "unknown"],
        )
        for technique, source in route
    ]
    status = "possible" if any(step.unknown for step in steps) else "open"
    return KretPath(
        id=">".join(step.technique for step in steps),
        target=steps[-1].target,
        status=status,
        steps=steps,
    )


def plan_moves(paths: list[KretPath], org: Organization, limit: int = MOVE_LIMIT) -> tuple[list[KretMove], int]:
    remaining = list(paths)
    candidates = [s for s in org.safeguards if s.state != "present"]
    moves: list[KretMove] = []
    while remaining and len(moves) < limit:
        best: tuple[tuple[int, int, str], Safeguard, list[KretPath]] | None = None
        for safeguard in candidates:
            cut = [p for p in remaining if any(safeguard.id in step.requires for step in p.steps)]
            if not cut:
                continue
            key = (-len(cut), safeguard.effort_minutes, safeguard.id)
            if best is None or key < best[0]:
                best = (key, safeguard, cut)
        if best is None:
            break
        _, chosen, cut = best
        moves.append(
            KretMove(
                safeguard=chosen.id,
                fix=chosen.fix,
                why=chosen.why,
                closes=len(cut),
                effort_minutes=chosen.effort_minutes,
                paths=[p.id for p in cut],
            )
        )
        cut_ids = {p.id for p in cut}
        remaining = [p for p in remaining if p.id not in cut_ids]
        candidates = [s for s in candidates if s.id != chosen.id]
    return moves, len(remaining)


def _segments(paths: list[KretPath], safeguards: dict[str, Safeguard]) -> list[KretSegment]:
    grouped: dict[tuple[str, str], list[Technique]] = defaultdict(list)
    for technique in TECHNIQUES:
        if not _applicable(technique, safeguards):
            continue
        for source in technique.sources:
            grouped[(source, technique.target)].append(technique)
    status: dict[tuple[str, str], str] = {}
    for path in paths:
        for step in path.steps:
            key = (step.source, step.target)
            if path.status == "open":
                status[key] = "open"
            else:
                status.setdefault(key, "possible")
    return [
        KretSegment(
            source=source,
            target=target,
            status=status.get((source, target), "closed"),
            techniques=[t.id for t in techniques],
            names=[t.name for t in techniques],
        )
        for (source, target), techniques in grouped.items()
    ]


def _targets(paths: list[KretPath], org: Organization) -> list[KretTarget]:
    targets = []
    for position in POSITIONS:
        if position.kind != "target":
            continue
        own = [p for p in paths if p.target == position.id]
        targets.append(
            KretTarget(
                id=position.id,
                label=position.label,
                description=_fill(position.description, org),
                open=sum(p.status == "open" for p in own),
                possible=sum(p.status == "possible" for p in own),
            )
        )
    return targets


def _stories(paths: list[KretPath], targets: list[KretTarget], safeguards: dict[str, Safeguard]) -> list[KretStory]:
    reached = [t for t in targets if t.open + t.possible]
    reached.sort(key=lambda t: (-(t.open + t.possible), -t.open))
    stories = []
    for target in reached:
        own = [p for p in paths if p.target == target.id]
        best = min(own, key=lambda p: (p.status != "open", len(p.steps), p.id))
        lines = [step.narrative for step in best.steps]
        for sid in dict.fromkeys(sid for step in best.steps for sid in step.unknown):
            lines.append(f"Tej drogi nie jestem pewien. Sprawdźcie, czy {lower_first(safeguards[sid].label)}.")
        count = len(own)
        stories.append(
            KretStory(
                target=target.id,
                title=f"{target.label}: {count} {plural(count, 'droga', 'drogi', 'dróg')}",
                path=best.id,
                lines=lines,
            )
        )
    return stories


def _intro(total: int, possible: int, reached: int) -> str:
    if total == 0:
        return "Przekopałem Waszą mapę i nie znalazłem żadnej drogi do miejsc, na których Wam zależy."
    places = "miejsca" if reached == 1 else "miejsc"
    text = (
        f"Przekopałem Waszą mapę. Znalazłem {total} {plural(total, 'drogę', 'drogi', 'dróg')} "
        f"do {reached} {places}, na których Wam zależy."
    )
    if possible:
        uncertain = plural(possible, "jest niepewna", "są niepewne", "jest niepewnych")
        text += f" {possible} z nich {uncertain}, bo czegoś nie wiem."
    return text


def _outro(total: int, moves: list[KretMove], remaining: int, minutes: int) -> str:
    if total == 0:
        return "Wpuśćcie mnie ponownie po każdej zmianie w biurze."
    if not moves:
        return "Nie znalazłem jednego ruchu, który zamyka te drogi. Trzeba je przejrzeć po kolei."
    first = moves[0]
    text = (
        f"Zacznijcie od tego: {lower_first(first.fix)}. "
        f"To zamyka {first.closes} z {total} {'drogi' if total == 1 else 'dróg'}."
    )
    count = len(moves)
    if remaining == 0:
        text += (
            f" Po {count} {'ruchu' if count == 1 else 'ruchach'} nie zostaje żadna otwarta droga."
            f" To około {minutes} {'minuty' if minutes == 1 else 'minut'} pracy."
        )
    else:
        verb = "zostają" if plural(remaining, "one", "few", "many") == "few" else "zostaje"
        text += f" Po tych ruchach {verb} {remaining} {plural(remaining, 'droga', 'drogi', 'dróg')}."
    return text


def run_kret(org: Organization) -> KretResult:
    safeguards = {s.id: s for s in org.safeguards}
    paths = find_paths(org)
    moves, remaining = plan_moves(paths, org)
    targets = _targets(paths, org)
    total = len(paths)
    possible = sum(p.status == "possible" for p in paths)
    minutes = sum(m.effort_minutes for m in moves)
    reached = sum(1 for t in targets if t.open + t.possible)
    return KretResult(
        created_at=now_iso(),
        total=total,
        possible=possible,
        remaining_after_moves=remaining,
        moves_minutes=minutes,
        paths=paths,
        moves=moves,
        targets=targets,
        good=[SafeguardRef(id=s.id, label=s.label, source=s.source) for s in org.safeguards if s.state == "present"],
        unknown=[SafeguardRef(id=s.id, label=s.label, source=s.source) for s in org.safeguards if s.state == "unknown"],
        intro=_intro(total, possible, reached),
        outro=_outro(total, moves, remaining, minutes),
        stories=_stories(paths, targets, safeguards),
        positions=[
            KretPosition(id=p.id, label=p.label, kind=p.kind, description=_fill(p.description, org)) for p in POSITIONS
        ],
        segments=_segments(paths, safeguards),
    )
