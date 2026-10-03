YES, NO, UNKNOWN = "yes", "no", "unknown"

YES_NO = [(YES, "Tak"), (NO, "Nie"), (UNKNOWN, "Nie wiem")]


def lvl(ctx: dict, hypothesis: str) -> str:
    return ctx["hyp"][hypothesis]["level"]


def answer(ctx: dict, qid: str) -> str:
    return ctx["a"].get(qid, UNKNOWN)


def why(items: list[tuple[bool, str]]) -> list[str]:
    return [text for ok, text in items if ok]


def safeguard_missing(org: dict, sid: str) -> bool:
    return any(s["id"] == sid and s["state"] != "present" for s in org["safeguards"])


def boss_name(org: dict) -> str | None:
    return next((p["name"] for p in org.get("people", []) if p.get("duty") == "boss"), None)


def phone_line(org: dict) -> str:
    phone = org.get("phone", "").strip()
    return f"prosimy o telefon: {phone}." if phone else "prosimy o kontakt telefoniczny."


def hypothesis(label: str, level: str, explain: str, because: list[str], warned: str | None) -> dict:
    return {"label": label, "level": level, "explain": explain, "because": because, "kret_warned": warned}
