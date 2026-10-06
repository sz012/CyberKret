import json

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from .. import db
from .. import org as org_mod
from ..incident import engine
from ..incident import playbook as pb
from ..llm import explain
from ..schemas import ActionStatus, Answers, Confirmation, NewIncident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


def _load(iid: int) -> dict:
    inc = db.get_incident(iid)
    if not inc:
        raise HTTPException(404, "No such incident")
    return inc


def _full(iid: int) -> dict:
    inc = _load(iid)
    sit = engine.situation(inc, db.get_org())
    return {**inc, "situation": sit, "events": db.list_events(iid)}


@router.get("/types")
def types():
    return pb.types()


@router.post("")
def create(body: NewIncident):
    if body.type not in pb.PLAYBOOKS:
        raise HTTPException(422, "No such playbook")
    facts = []
    if body.mail_id:
        r = db.get_mail(body.mail_id)
        if r and r["analysis_json"]:
            facts = [i for i in json.loads(r["analysis_json"])["indicators"] if i["severity"] in ("high", "medium")]
    iid = db.create_incident(body.type, facts, body.mail_id)
    org = db.get_org()
    sit = engine.situation(db.get_incident(iid), org)
    db.update_incident(iid, plan_ids=[a["id"] for a in sit["plan"]])
    db.add_event(iid, "start", f"Incident reported: {pb.get(body.type).LABEL}."
                 + (f" The mail mole passed on {len(facts)} facts." if facts else ""))
    db.add_event(iid, "plan", f"Starting plan: {len(sit['plan'])} steps, {len(sit['act_now'])} to do right away.")
    return _full(iid)


@router.get("")
def list_():
    out = []
    for inc in db.list_incidents():
        out.append({"id": inc["id"], "type": inc["type"], "type_label": pb.get(inc["type"]).LABEL,
                    "status": inc["status"], "created_at": inc["created_at"], "closed_at": inc["closed_at"],
                    "done": sum(1 for v in inc["action_status"].values() if v == "done")})
    return out


@router.get("/{iid}")
def get(iid: int):
    return _full(iid)


@router.patch("/{iid}/answers")
def answers(iid: int, body: Answers):
    inc = _load(iid)
    org = db.get_org()
    book = pb.get(inc["type"])
    new = dict(inc["answers"])
    answered_at = dict(inc["answered_at"])
    changed = []
    for k, v in body.answers.items():
        q = pb.question(org, book, k)
        if not q or v not in {o[0] for o in q["options"]}:
            raise HTTPException(422, f"Invalid answer: {k}={v}")
        if new.get(k) != v:
            new[k] = v
            answered_at[k] = db.now()
            changed.append((q, dict(q["options"])[v]))
    if not changed:
        return _full(iid)

    hyp_before = book.hypotheses(inc["answers"], inc["facts"], org)
    db.update_incident(iid, answers=new, answered_at=answered_at)
    inc = _load(iid)
    sit = engine.situation(inc, org)
    new_ids = [a["id"] for a in sit["plan"]]
    added, removed = engine.diff_plan(inc["plan_ids"], new_ids)
    db.update_incident(iid, plan_ids=new_ids)

    for q, label in changed:
        db.add_event(iid, "fact", f"New fact: {q['text']} → {label}")
    for h_id, h in sit["hypotheses"].items():
        if hyp_before[h_id]["level"] != h["level"]:
            db.add_event(iid, "hypothesis", f"{h['label']}: {_lvl(hyp_before[h_id]['level'])} → {_lvl(h['level'])}.")
    if added or removed:
        title = {a["id"]: a["title"] for a in book.ACTIONS}
        done_removed = [i for i in removed if inc["action_status"].get(i) == "done"]
        msg = f"Plan rebuilt: +{len(added)} {_steps(len(added))}, −{len(removed)} {_steps(len(removed))}."
        if added:
            msg += " Added: " + "; ".join(title[i] for i in added) + "."
        if removed:
            msg += " Dropped: " + "; ".join(title[i] for i in removed) + "."
        if done_removed:
            msg += " Steps done earlier stay in the log: " + "; ".join(title[i] for i in done_removed) + "."
        db.add_event(iid, "plan", msg)
    return _full(iid)


def _lvl(level: str) -> str:
    return {"likely": "likely", "possible": "possible", "unlikely": "unlikely"}[level]


def _steps(n: int) -> str:
    return "step" if n == 1 else "steps"


@router.patch("/{iid}/actions/{aid}")
def action(iid: int, aid: str, body: ActionStatus):
    inc = _load(iid)
    a = pb.action(pb.get(inc["type"]), aid)
    if not a:
        raise HTTPException(404, "No such step")
    st = dict(inc["action_status"])
    if st.get(aid, "todo") != body.status:
        st[aid] = body.status
        db.update_incident(iid, action_status=st)
        if body.status == "done":
            db.add_event(iid, "action", f"Zrobione: {a['title']} ({org_mod.role_label(db.get_org(), a['role'])}).")
    return _full(iid)


@router.patch("/{iid}/confirmations/{cid}")
def confirm(iid: int, cid: str, body: Confirmation):
    inc = _load(iid)
    org = db.get_org()
    labels = {c_id: label for c in org.get("continuity", []) for c_id, label in c["confirmations"]}
    if cid not in labels:
        raise HTTPException(404, "No such confirmation")
    before = engine.continuity(inc["answers"], inc["confirmations"], org)["maintained"]
    conf = dict(inc["confirmations"])
    conf[cid] = body.done
    db.update_incident(iid, confirmations=conf)
    db.add_event(iid, "continuity", ("Confirmed: " if body.done else "Confirmation withdrawn: ") + labels[cid] + ".")
    after = engine.continuity(inc["answers"], conf, org)["maintained"]
    if after and not before:
        db.add_event(iid, "continuity", "Critical work is running. Email stays untrusted.")
    return _full(iid)


@router.post("/{iid}/close")
def close(iid: int):
    inc = _load(iid)
    if inc["status"] != "closed":
        db.update_incident(iid, status="closed", closed_at=db.now())
        lesson = " The mole suggests filling in the tunnels the threat came through." if pb.get(inc["type"]).LESSONS else ""
        db.add_event(iid, "close", f"Incident closed.{lesson}")
    return _full(iid)


@router.get("/{iid}/brief")
async def brief(iid: int):
    inc = _load(iid)
    sit = engine.situation(inc, db.get_org())
    return await run_in_threadpool(explain.incident_brief, sit)
