from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from .. import db
from ..kret import domain_check, engine, local_agent
from ..llm import explain
from ..schemas import ApplySafeguards, DomainCheck

router = APIRouter(prefix="/api/kret", tags=["kret"])


@router.post("/run")
def run(label: str | None = None):
    return db.add_run(engine.run(db.get_org()), label)


@router.get("/runs")
def runs():
    return db.list_runs()


@router.get("/runs/{run_id}/story")
async def story(run_id: int):
    r = db.get_run(run_id)
    if not r:
        raise HTTPException(404, "No such mole run")
    return await run_in_threadpool(explain.kret_story, r)


@router.post("/domain-check")
async def domain(body: DomainCheck):
    if not body.consent:
        raise HTTPException(400, "The mole only checks domains you have the right to check. Confirm your consent.")
    try:
        result = await run_in_threadpool(domain_check.check, body.domain)
    except domain_check.DomainError as e:
        raise HTTPException(422, str(e))
    org = db.get_org()
    changed = []
    if body.apply:
        changed = domain_check.apply_to_org(org, result)
        db.save_org(org)
    return {**result, "applied": changed}


@router.post("/local-check")
async def local(apply: bool = True):
    result = await run_in_threadpool(local_agent.check)
    changed = []
    if apply:
        org = db.get_org()
        changed = local_agent.apply_to_org(org, result)
        db.save_org(org)
    return {**result, "applied": changed}


@router.post("/apply")
def apply(body: ApplySafeguards):
    """Fill tunnels: mark safeguards as done after the team applied them."""
    org = db.get_org()
    done = []
    for s in org["safeguards"]:
        if s["id"] in body.safeguards:
            s["state"], s["source"] = "present", "fixed"
            done.append(s["id"])
    db.save_org(org)
    return {"applied": done}
