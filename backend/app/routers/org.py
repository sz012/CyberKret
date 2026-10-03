from fastapi import APIRouter, HTTPException

from .. import db
from ..incident.card import emergency_card
from ..schemas import SafeguardPatch

router = APIRouter(prefix="/api/org", tags=["org"])


@router.get("")
def get_org():
    return db.get_org()


@router.get("/card")
def card():
    return emergency_card(db.get_org())


@router.patch("/safeguards/{sid}")
def patch_safeguard(sid: str, body: SafeguardPatch):
    org = db.get_org()
    s = next((s for s in org["safeguards"] if s["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Nie ma takiego zabezpieczenia")
    s["state"], s["source"] = body.state, body.source
    db.save_org(org)
    return s
