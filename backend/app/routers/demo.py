import json
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from fastapi import APIRouter

from .. import config, db
from ..incident.engine import situation
from ..kret.engine import run
from ..mail.analyze import parse, rules

router = APIRouter(prefix="/api/demo", tags=["demo"])

MAILBOX = "inbox"
PENDING = {"01_biurex_phishing"}  # arrives live during the demo


@router.get("/presentation")
def presentation():
    org = json.loads((config.SEED_DIR / "nowak_law_office.json").read_text())
    before = run(org)
    improved = json.loads(json.dumps(org))
    first = before["moves"][0]["safeguard"]
    for safeguard in improved["safeguards"]:
        if safeguard["id"] == first:
            safeguard["state"] = "present"
    after = run(improved)
    mail = rules(parse((config.SEED_DIR / "emails" / "01_biurex_phishing.eml").read_text()), org)
    incident = {
        "type": "fake_invoice", "answers": {"paid": "no", "sent": "no", "clicked": "no", "clients": "unknown"},
        "facts": mail["indicators"], "action_status": {}, "confirmations": {}, "answered_at": {},
    }
    return {"org": org, "before": before, "after": after, "mail": mail, "situation": situation(incident, org)}


def reset() -> None:
    db.wipe()
    db.save_org(json.loads((config.SEED_DIR / "nowak_law_office.json").read_text()))
    from ..mail.analyze import parse

    paths = sorted((config.SEED_DIR / "emails").glob("*.eml"))
    dates = {p.stem: parsedate_to_datetime(str(parse(p.read_text())["Date"])) for p in paths}
    # Seed mails keep their relative order but land in the last day, the newest 40 minutes ago.
    newest = max(d for k, d in dates.items() if k not in PENDING)
    shift = datetime.now(timezone.utc) - timedelta(minutes=40) - newest
    for path in paths:
        delivered = path.stem not in PENDING
        received = (dates[path.stem] + shift).isoformat(timespec="seconds") if delivered else None
        db.upsert_mail(path.stem, MAILBOX, path.read_text(), delivered, received)


def reset_if_empty() -> None:
    with db.conn() as c:
        empty = c.execute("SELECT COUNT(*) FROM organization").fetchone()[0] == 0
    if empty:
        reset()


@router.post("/reset")
def reset_endpoint():
    reset()
    return {"ok": True}
