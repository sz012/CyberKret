from fastapi import APIRouter, HTTPException

from .. import db
from .. import org as org_mod
from ..incident.card import emergency_card
from ..schemas import NewOrg, OrgProfile, SafeguardPatch

router = APIRouter(prefix="/api/org", tags=["org"])


@router.get("")
def get_org():
    return org_mod.enrich(db.get_org())


@router.get("/card")
def card():
    return emergency_card(db.get_org())


@router.put("/profile")
def save_profile(body: OrgProfile):
    try:
        org = org_mod.apply_profile(db.get_org(), body.model_dump())
    except org_mod.OrgError as e:
        raise HTTPException(422, str(e))
    db.save_org(org)
    return org_mod.enrich(org)


@router.post("/new")
def new_org(body: NewOrg):
    db.wipe()
    org = org_mod.template(body.name)
    db.save_org(org)
    return org_mod.enrich(org)


@router.patch("/safeguards/{sid}")
def patch_safeguard(sid: str, body: SafeguardPatch):
    org = db.get_org()
    s = next((s for s in org["safeguards"] if s["id"] == sid), None)
    if not s:
        raise HTTPException(404, "Nie ma takiego zabezpieczenia")
    s["state"], s["source"] = body.state, body.source
    db.save_org(org)
    return s
