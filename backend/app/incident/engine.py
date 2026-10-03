"""Computes the incident situation from stored answers: facts, hypotheses, plan, continuity and map impact."""
from datetime import datetime, timedelta
from types import ModuleType

from .. import org as org_mod
from . import playbook as pb
from .playbook import UNKNOWN


def plan(book: ModuleType, answers: dict, hyp: dict, org: dict) -> list[dict]:
    ctx = {"a": answers, "hyp": hyp, "org": org}
    order = list(pb.PRIORITY)
    out = []
    for a in book.ACTIONS:
        if a["when"](ctx):
            out.append({k: v for k, v in a.items() if k != "when"} | {
                "priority_label": pb.PRIORITY[a["priority"]], "role_label": org_mod.role_label(org, a["role"])})
    return sorted(out, key=lambda a: (order.index(a["priority"]), not a["safe_any_cause"]))


def diff_plan(old_ids: list[str], new_ids: list[str]) -> tuple[list[str], list[str]]:
    return [i for i in new_ids if i not in old_ids], [i for i in old_ids if i not in new_ids]


def continuity(answers: dict, confirmations: dict, org: dict) -> dict:
    prio = answers.get("priority")
    items = []
    for c in org.get("continuity", []):
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
    name = org.get("name") or "Firma"
    return {"items": items, "maintained": maintained,
            "banner": f"{name} działa. Poczta pozostaje niezaufana." if maintained else None}


def phases(steps: list[dict], cont: dict, lessons: list[dict]) -> list[dict]:
    out = []
    for pid, label in pb.PHASES:
        own = [s for s in steps if s["phase"] == pid]
        done, total = sum(s["status"] == "done" for s in own), len(own)
        if pid == "continue":
            confs = [c for i in cont["items"] if i["critical"] for c in i["confirmations"]]
            done, total = done + sum(c["done"] for c in confs), total + len(confs)
        elif pid == "learn":
            done, total = done + sum(s["state"] == "present" for s in lessons), total + len(lessons)
        out.append({"id": pid, "label": label, "done": done, "total": total})
    return out


def map_impact(book: ModuleType, answers: dict, org: dict) -> dict:
    return {**book.impact(answers), "fallbacks": [f["label"] for f in org.get("fallbacks", [])]}


def uodo_clock(book: ModuleType, answers: dict, answered_at: dict, hyp: dict) -> dict | None:
    if not book.uodo(answers, hyp) or book.UODO_QUESTION not in answered_at:
        return None
    start = datetime.fromisoformat(answered_at[book.UODO_QUESTION])
    return {"started_at": start.isoformat(), "deadline": (start + timedelta(hours=72)).isoformat()}


def situation(inc: dict, org: dict) -> dict:
    book = pb.get(inc["type"])
    answers, facts = inc["answers"], inc["facts"]
    hyp = book.hypotheses(answers, facts, org)
    steps = plan(book, answers, hyp, org)
    status = inc["action_status"]
    for s in steps:
        s["status"] = status.get(s["id"], "todo")

    confirmed = [{"text": f["title"] + (f": {f['detail']}" if f.get("detail") else ""), "source": "kret pocztowy"}
                 for f in facts if f.get("severity") in ("high", "medium")]
    unverified = []
    qs = pb.questions(org, book)
    for q in qs:
        if q["id"] == "priority":
            continue
        kind, text = book.FACTS[(q["id"], answers.get(q["id"], UNKNOWN))]
        src = "z Twoich odpowiedzi" if q["id"] in answers else "brak odpowiedzi"
        (confirmed if kind == "confirmed" else unverified).append({"text": text, "source": src, "question": q["id"]})

    cont = continuity(answers, inc["confirmations"], org)
    lessons = [s for s in org["safeguards"] if s["id"] in book.LESSONS]
    return {
        "type_label": book.LABEL,
        "questions": [{"id": q["id"], "text": q["text"], "options": [{"value": v, "label": l} for v, l in q["options"]],
                       "answer": answers.get(q["id"])} for q in qs],
        "confirmed": confirmed,
        "unverified": unverified,
        "hypotheses": hyp,
        "act_now": [s for s in steps if s["safe_any_cause"] or s["priority"] == "now"],
        "plan": steps,
        "continuity": cont,
        "phases": phases(steps, cont, lessons),
        "map": map_impact(book, answers, org),
        "uodo": uodo_clock(book, answers, inc["answered_at"], hyp),
        "messages": book.messages(org, facts, answers),
        "lessons": lessons,
    }
