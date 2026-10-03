"""Kret engine: finds attack paths ("tunnels") from the internet to what hurts, and picks the moves that close most."""
from .techniques import ENTRY, POSITIONS, TECHNIQUES

SOURCE_LABEL = {
    "kret": "sprawdził kret",
    "answers": "z Twoich odpowiedzi",
    "unverified": "niepotwierdzone",
    "fixed": "zasypane po incydencie",
}


def technique_state(tech: dict, states: dict[str, str]) -> str:
    """open: every required safeguard missing; possible: some unknown; closed: any present."""
    req = [states.get(s, "unknown") for s in tech["requires_missing"]]
    if any(s == "present" for s in req):
        return "closed"
    if any(s == "unknown" for s in req):
        return "possible"
    return "open"


def find_paths(org: dict) -> list[dict]:
    states = {s["id"]: s["state"] for s in org["safeguards"]}
    targets = {t["id"]: t for t in org["targets"]}
    edges: dict[str, list[tuple[dict, str]]] = {}
    for t in TECHNIQUES:
        st = technique_state(t, states)
        if st == "closed":
            continue
        for src in t["src"]:
            edges.setdefault(src, []).append((t, st))

    paths: list[dict] = []

    def dfs(pos: str, steps: list[tuple[dict, str]], seen: set[str]) -> None:
        if pos in targets and steps:
            paths.append({"target": pos, "steps": list(steps)})
            return
        for tech, st in edges.get(pos, []):
            if tech["dst"] in seen:
                continue
            steps.append((tech, st))
            dfs(tech["dst"], steps, seen | {tech["dst"]})
            steps.pop()

    dfs(ENTRY, [], {ENTRY})

    out = []
    for i, p in enumerate(paths, 1):
        state = "open" if all(st == "open" for _, st in p["steps"]) else "possible"
        safeguards = sorted({s for t, _ in p["steps"] for s in t["requires_missing"]})
        chambers: list[str] = []
        for t, _ in p["steps"]:
            if not chambers or chambers[-1] != t["chamber"]:
                chambers.append(t["chamber"])
        out.append({
            "id": "tunnel-" + "-".join(t["id"] for t, _ in p["steps"]),
            "n": i,
            "target": p["target"],
            "target_label": targets[p["target"]]["label"],
            "harm": targets[p["target"]]["harm"],
            "weight": targets[p["target"]]["weight"],
            "state": state,
            "chambers": chambers,
            "safeguards": safeguards,
            "steps": [
                {
                    "technique": t["id"], "name": t["name"], "chamber": t["chamber"],
                    "from": t["src"], "to": t["dst"],
                    "to_label": targets[t["dst"]]["label"] if t["dst"] in targets else POSITIONS[t["dst"]],
                    "state": st, "narration": t["narration"],
                }
                for t, st in p["steps"]
            ],
        })
    return out


def pick_moves(org: dict, tunnels: list[dict], limit: int = 3) -> list[dict]:
    """Greedy: the safeguard that cuts the most target weight first, ties go to the smaller effort."""
    sg = {s["id"]: s for s in org["safeguards"]}
    remaining = list(tunnels)
    moves = []
    while remaining and len(moves) < limit:
        candidates = {s for t in remaining for s in t["safeguards"] if sg.get(s, {}).get("state") != "present"}
        if not candidates:
            break

        def score(s: str):
            cut = [t for t in remaining if s in t["safeguards"]]
            return (sum(t["weight"] for t in cut), -sg[s]["effort_min"])

        best = max(sorted(candidates), key=score)
        cut = [t for t in remaining if best in t["safeguards"]]
        s = sg[best]
        moves.append({
            "safeguard": best, "label": s["label"], "chamber": s["chamber"], "fix": s["fix"],
            "effort_min": s["effort_min"], "cost": s["cost"],
            "closes": [t["id"] for t in cut],
            "closes_targets": sorted({t["target_label"] for t in cut}),
        })
        remaining = [t for t in remaining if best not in t["safeguards"]]
    return moves


def chamber_findings(org: dict, tunnels: list[dict]) -> list[dict]:
    """Per chamber: status light plus one line per safeguard, in the order the kret visits them."""
    on_open_path = {s for t in tunnels if t["state"] == "open" for s in t["safeguards"]}
    by_chamber: dict[str, list[dict]] = {}
    for s in org["safeguards"]:
        by_chamber.setdefault(s["chamber"], []).append(s)

    out = []
    for ch in org["chambers"]:
        items = []
        for s in by_chamber.get(ch["id"], []):
            if s["state"] == "present":
                level, text = "ok", s["ok_text"]
            elif s["state"] == "missing":
                level, text = ("bad" if s["id"] in on_open_path else "warn"), s["problem"]
            else:
                level, text = "warn", s["problem"] + " (niepotwierdzone)"
            items.append({
                "safeguard": s["id"], "label": s["label"], "level": level, "text": text,
                "state": s["state"], "source": s["source"], "source_label": SOURCE_LABEL.get(s["source"], s["source"]),
                "evidence": s["evidence"], "fix": s["fix"],
            })
        rank = {"ok": 0, "warn": 1, "bad": 2}
        status = max((i["level"] for i in items), key=rank.get, default="ok")
        out.append({"chamber": ch["id"], "label": ch["label"], "dig": ch["dig"], "status": status, "items": items})
    return out


def summary_line(tunnels: list[dict], moves: list[dict]) -> str:
    open_n = sum(1 for t in tunnels if t["state"] == "open")
    poss_n = len(tunnels) - open_n
    if not tunnels:
        return "Kret nie znalazł żadnego tunelu do akt, pieniędzy ani do zatrzymania pracy. Tak trzymać."
    targets = sorted({t["target_label"] for t in tunnels})
    first = moves[0] if moves else None
    head = f"Kret znalazł {len(tunnels)} {_tunele(len(tunnels))} prowadzących do: {', '.join(targets).lower()}."
    if poss_n:
        head += f" {open_n} otwartych, {poss_n} możliwych."
    if first:
        head += f" Zacznij od: {first['label'].lower()} ({first['effort_min']} min), to zamyka {len(first['closes'])} z {len(tunnels)}."
    return head


def _tunele(n: int) -> str:
    if n == 1:
        return "tunel"
    if n % 10 in (2, 3, 4) and n % 100 not in (12, 13, 14):
        return "tunele"
    return "tuneli"


def run(org: dict) -> dict:
    tunnels = find_paths(org)
    moves = pick_moves(org, tunnels)
    left = [t for t in tunnels if not any(m["safeguard"] in t["safeguards"] for m in moves)]
    return {
        "org": org["name"],
        "tunnels": tunnels,
        "moves": moves,
        "chambers": chamber_findings(org, tunnels),
        "counts": {
            "open": sum(1 for t in tunnels if t["state"] == "open"),
            "possible": sum(1 for t in tunnels if t["state"] == "possible"),
            "after_moves": len(left),
        },
        "summary": summary_line(tunnels, moves),
    }
