from fastapi import APIRouter, Query

from ..deps import LlmDep, StoreDep
from ..schemas import Health, LlmStatus, LogEntry, Organization
from ..seed import load_seed

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health", response_model=Health)
def health(llm: LlmDep) -> Health:
    return Health(status="ok", llm=LlmStatus(available=llm.available(), model=llm.model))


@router.get("/log", response_model=list[LogEntry])
def event_log(store: StoreDep, limit: int = Query(default=30, ge=1, le=200)) -> list[LogEntry]:
    return store.list_log(limit=limit)


@router.post("/demo/reset", response_model=Organization)
def reset_demo(store: StoreDep) -> Organization:
    seed = load_seed()
    store.reset(seed)
    store.log("demo_reset", "Przywrócono dane demonstracyjne biura.")
    return seed
