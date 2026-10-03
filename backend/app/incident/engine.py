"""Computes the incident situation from stored answers: facts, hypotheses, plan, continuity and map impact."""
from datetime import datetime, timedelta

from . import playbook as pb
from .playbook import NO, UNKNOWN, YES

ANSWER_FACTS = {
    ("paid", YES): ("confirmed", "Przelew na numer oszusta już wyszedł."),
    ("paid", NO): ("confirmed", "Nikt nie zapłacił na nowy numer."),
    ("paid", UNKNOWN): ("unverified", "Nie wiadomo, czy ktoś zapłacił."),
    ("sent", YES): ("confirmed", "W Wysłanych są maile, których nikt nie pisał."),
    ("sent", NO): ("confirmed", "W Wysłanych nie ma obcych maili."),
    ("sent", UNKNOWN): ("unverified", "Nikt jeszcze nie sprawdził folderu Wysłane."),
    ("clicked", YES): ("confirmed", "Ktoś kliknął link lub wpisał hasło."),
    ("clicked", NO): ("confirmed", "Nikt nie klikał linków ani nie wpisywał hasła."),
    ("clicked", UNKNOWN): ("unverified", "Nie wiadomo, czy ktoś kliknął link."),
    ("clients", YES): ("confirmed", "Ktoś niepowołany mógł zobaczyć dane klientów."),
    ("clients", NO): ("confirmed", "Dane klientów nie były narażone."),
    ("clients", UNKNOWN): ("unverified", "Nie wiadomo, czy dane klientów były narażone."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    sent, clicked = answers.get("sent", UNKNOWN), answers.get("clicked", UNKNOWN)
    lookalike = any(f.get("type") in ("lookalike_sender", "reply_to_mismatch") for f in facts)
    dmarc_missing = any(s["id"] == "domain_dmarc" and s["state"] != "present" for s in org["safeguards"])
    mfa_missing = any(s["id"] == "m365_mfa" and s["state"] != "present" for s in org["safeguards"])

    if sent == YES or clicked == YES:
        takeover = "likely"
    elif sent == NO and clicked == NO:
        takeover = "unlikely"
    else:
        takeover = "possible"

    if takeover == "likely":
        spoof = "possible" if lookalike else "unlikely"
    elif lookalike or sent == NO:
        spoof = "likely"
    else:
        spoof = "possible"

    def why(items):
        return [t for ok, t in items if ok]

    return {
        "spoof": {
            "label": "Podszycie z zewnątrz", "level": spoof,
            "explain": "Oszust pisze z podobnej domeny albo udaje kancelarię. Nasza skrzynka jest cała.",
            "because": why([(lookalike, "kret pocztowy: domena nadawcy udaje znanego kontrahenta"),
                            (sent == NO, "w Wysłanych nie ma obcych maili")]),
            "kret_warned": "Kret ostrzegał: domena kancelarii nie ma DMARC." if dmarc_missing else None,
        },
        "takeover": {
            "label": "Przejęte konto pocztowe", "level": takeover,
            "explain": "Oszust zalogował się na nasze konto i pisze z niego.",
            "because": why([(sent == YES, "w Wysłanych są obce maile"), (clicked == YES, "ktoś wpisał hasło"),
                            (sent == UNKNOWN, "folder Wysłane niesprawdzony")]),
            "kret_warned": "Kret ostrzegał: konto księgowości nie ma MFA." if mfa_missing else None,
        },
    }


def plan(answers: dict, hyp: dict, org: dict) -> list[dict]:
    ctx = {"a": answers, "hyp": hyp, "org": org}
    order = list(pb.PRIORITY)
    out = []
    for a in pb.ACTIONS:
        if a["when"](ctx):
            out.append({k: v for k, v in a.items() if k != "when"} | {
                "priority_label": pb.PRIORITY[a["priority"]], "role_label": pb.ROLES[a["role"]]})
    return sorted(out, key=lambda a: (order.index(a["priority"]), not a["safe_any_cause"]))


def diff_plan(old_ids: list[str], new_ids: list[str]) -> tuple[list[str], list[str]]:
    return [i for i in new_ids if i not in old_ids], [i for i in old_ids if i not in new_ids]


def continuity(answers: dict, confirmations: dict) -> dict:
    prio = answers.get("priority")
    items = []
    for c in pb.CONTINUITY:
        confs = [{"id": cid, "label": label, "done": bool(confirmations.get(cid))} for cid, label in c["confirmations"]]
        done = sum(x["done"] for x in confs)
        if c["id"] == "email":
            status = "ok" if done == len(confs) else "at_risk"
        elif done == len(confs):
            status = "fallback"
        elif done:
            status = "paused"
        else:
            status = "at_risk"
        items.append({"id": c["id"], "label": c["label"], "critical": c["critical"] or c["id"] == prio,
                      "top": c["id"] == prio, "fallback": c["fallback"], "status": status, "confirmations": confs})
    critical = [i for i in items if i["critical"]]
    maintained = all(all(x["done"] for x in i["confirmations"]) for i in critical)
    return {"items": items, "maintained": maintained,
            "banner": "Kancelaria działa. Poczta pozostaje niezaufana." if maintained else None}


def map_impact(org: dict) -> dict:
    return {
        "untrusted": ["poczta", "konta"],
        "at_risk": ["procedury", "client_data_read", "money_stolen"],
        "fallbacks": [f["label"] for f in org.get("fallbacks", [])],
    }


def uodo_clock(answers: dict, answered_at: dict) -> dict | None:
    if answers.get("clients") != YES or "clients" not in answered_at:
        return None
    start = datetime.fromisoformat(answered_at["clients"])
    return {"started_at": start.isoformat(), "deadline": (start + timedelta(hours=72)).isoformat()}


def situation(inc: dict, org: dict) -> dict:
    answers, facts = inc["answers"], inc["facts"]
    hyp = hypotheses(answers, facts, org)
    steps = plan(answers, hyp, org)
    status = inc["action_status"]
    for s in steps:
        s["status"] = status.get(s["id"], "todo")

    confirmed = [{"text": f["title"] + (f": {f['detail']}" if f.get("detail") else ""), "source": "kret pocztowy"}
                 for f in facts if f.get("severity") in ("high", "medium")]
    unverified = []
    for q in pb.QUESTIONS:
        if q["id"] == "priority":
            continue
        key = (q["id"], answers.get(q["id"], UNKNOWN))
        kind, text = ANSWER_FACTS[key]
        src = "z Twoich odpowiedzi" if q["id"] in answers else "brak odpowiedzi"
        (confirmed if kind == "confirmed" else unverified).append({"text": text, "source": src, "question": q["id"]})

    return {
        "type_label": pb.TYPES[inc["type"]]["label"],
        "questions": [{"id": q["id"], "text": q["text"], "options": [{"value": v, "label": l} for v, l in q["options"]],
                       "answer": answers.get(q["id"])} for q in pb.QUESTIONS],
        "confirmed": confirmed,
        "unverified": unverified,
        "hypotheses": hyp,
        "act_now": [s for s in steps if s["safe_any_cause"] or s["priority"] == "now"],
        "plan": steps,
        "continuity": continuity(answers, inc["confirmations"]),
        "map": map_impact(org),
        "uodo": uodo_clock(answers, inc["answered_at"]),
        "messages": pb.MESSAGES,
        "lessons": [s for s in org["safeguards"] if s["id"] in pb.LESSONS],
    }
