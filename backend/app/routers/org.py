from fastapi import APIRouter, HTTPException

from ..deps import StoreDep
from ..schemas import Organization, SafeguardUpdate

router = APIRouter(prefix="/api/org", tags=["org"])

STATE_LABELS = {"present": "jest", "missing": "brak", "unknown": "nie wiadomo"}


@router.get("", response_model=Organization)
def get_org(store: StoreDep) -> Organization:
    return store.get_org()


@router.patch("/safeguards/{safeguard_id}", response_model=Organization)
def update_safeguard(safeguard_id: str, body: SafeguardUpdate, store: StoreDep) -> Organization:
    org = store.get_org()
    safeguard = next((s for s in org.safeguards if s.id == safeguard_id), None)
    if safeguard is None:
        raise HTTPException(status_code=404, detail="Nie ma takiego zabezpieczenia.")
    if safeguard.state == body.state and safeguard.source == body.source:
        return org
    safeguard.state = body.state
    safeguard.source = body.source
    store.save_org(org)
    store.log("safeguard", f"Zabezpieczenie „{safeguard.label}”: {STATE_LABELS[body.state]}.")
    return org
