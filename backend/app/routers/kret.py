from fastapi import APIRouter, HTTPException

from ..db import Store
from ..deps import StoreDep
from ..kret.domain_check import DomainCheckError, check_domain, safeguard_states
from ..kret.engine import run_kret
from ..schemas import DomainCheckRequest, DomainCheckResponse, KretResult, KretRunSummary
from ..seed import load_domain_fixture
from ..text import plural

router = APIRouter(prefix="/api/kret", tags=["kret"])


def dig_and_store(store: Store) -> KretResult:
    org = store.get_org()
    result = store.add_kret_run(org.id, run_kret(org))
    if result.total:
        first = result.moves[0].fix if result.moves else "brak jednego ruchu"
        message = (
            f"Kret przekopał mapę: {result.total} {plural(result.total, 'droga', 'drogi', 'dróg')}. "
            f"Pierwszy ruch: {first}."
        )
    else:
        message = "Kret przekopał mapę: brak otwartych dróg."
    store.log("kret_run", message)
    return result


@router.post("/run", response_model=KretResult)
def run(store: StoreDep) -> KretResult:
    return dig_and_store(store)


@router.get("/runs", response_model=list[KretRunSummary])
def runs(store: StoreDep) -> list[KretRunSummary]:
    return store.list_kret_runs()


@router.get("/runs/latest", response_model=KretResult | None)
def latest(store: StoreDep) -> KretResult | None:
    return store.latest_kret_run()


@router.post("/domain-check", response_model=DomainCheckResponse)
def domain_check(body: DomainCheckRequest, store: StoreDep) -> DomainCheckResponse:
    if not body.consent:
        raise HTTPException(status_code=400, detail="Potwierdź, że to Wasza domena albo macie zgodę właściciela.")
    try:
        check = check_domain(body.domain, demo_fixture=load_domain_fixture)
    except DomainCheckError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    org = store.get_org()
    applied = check.domain == org.domain
    if applied:
        states = safeguard_states(check)
        for safeguard in org.safeguards:
            if safeguard.id in states:
                safeguard.state = states[safeguard.id]
                safeguard.source = "kret"
        org.domain_check = check
        store.save_org(org)
    bad = sum(f.status == "bad" for f in check.findings)
    problems = plural(bad, "poważny problem", "poważne problemy", "poważnych problemów")
    store.log("domain_check", f"Kret sprawdził domenę {check.domain}: {bad} {problems}.")
    return DomainCheckResponse(check=check, applied=applied)
