import json
import uuid
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from .. import db
from .. import org as org_mod
from ..mail import analyze as mail_an
from ..mail import imap_sync
from ..schemas import AnalyzeText, UploadEml
from .demo import MAILBOX

router = APIRouter(prefix="/api", tags=["mail"])


def _row_summary(r) -> dict:
    s = mail_an.summarize(mail_an.parse(r["eml"]))
    a = json.loads(r["analysis_json"]) if r["analysis_json"] else None
    return {
        "id": r["id"], "received_at": r["received_at"], "from_name": s["from_name"], "from_addr": s["from_addr"],
        "subject": s["subject"], "snippet": s["text"][:140], "attachments": s["attachments"],
        "scan": {k: a[k] for k in ("verdict", "label", "level")} if a else None,
    }


@router.get("/mail")
def inbox():
    org = db.get_org()
    owner = org_mod.mailbox_owner(org)
    return {
        "mailbox": MAILBOX, "owner": owner["name"] if owner else "", "owner_role": owner["role"] if owner else "",
        "demo": bool(org.get("demo")), "imap": imap_sync.status(),
        "messages": [_row_summary(r) for r in db.list_mail(MAILBOX)],
    }


@router.get("/mail/{mail_id}")
def message(mail_id: str):
    r = db.get_mail(mail_id)
    if not r:
        raise HTTPException(404, "Nie ma takiego maila")
    s = mail_an.summarize(mail_an.parse(r["eml"]))
    s.pop("html")
    return {"id": r["id"], "received_at": r["received_at"], **s,
            "analysis": json.loads(r["analysis_json"]) if r["analysis_json"] else None}


def _row(mail_id: str):
    r = db.get_mail(mail_id)
    if not r:
        raise HTTPException(404, "Nie ma takiego maila")
    return r


def _scan(mail_id: str) -> dict:
    r = _row(mail_id)
    result = mail_an.rules(mail_an.parse(r["eml"]), db.get_org())
    db.save_mail_analysis(mail_id, result)
    return result


def _explain(mail_id: str) -> dict:
    r = _row(mail_id)
    org = db.get_org()
    msg = mail_an.parse(r["eml"])
    result = json.loads(r["analysis_json"]) if r["analysis_json"] else mail_an.rules(msg, org)
    result = mail_an.explain(result, msg, org, org_mod.first_name(org_mod.mailbox_owner(org)))
    db.save_mail_analysis(mail_id, result)
    return result


@router.post("/mail/{mail_id}/scan")
async def scan(mail_id: str):
    return await run_in_threadpool(_scan, mail_id)


@router.post("/mail/{mail_id}/explain")
async def explain(mail_id: str):
    return await run_in_threadpool(_explain, mail_id)


@router.post("/mail/deliver-next")
def deliver_next():
    if not db.get_org().get("demo"):
        raise HTTPException(409, "Maile demo działają tylko w firmie demo.")
    with db.conn() as c:
        r = c.execute("SELECT id FROM mail WHERE mailbox = ? AND delivered = 0 ORDER BY id LIMIT 1", (MAILBOX,)).fetchone()
    if not r:
        raise HTTPException(409, "Brak kolejnych maili w scenariuszu demo")
    db.deliver_mail(r["id"])
    return {"id": r["id"]}


@router.post("/mail/sync")
async def sync():
    try:
        return await run_in_threadpool(imap_sync.sync, MAILBOX)
    except imap_sync.ImapError as e:
        raise HTTPException(400, str(e))


@router.post("/mail/upload")
def upload(body: UploadEml):
    msg = mail_an.parse(body.eml)
    if not msg.get("From") and not msg.get("Subject"):
        raise HTTPException(422, "To nie wygląda na plik .eml")
    mid = "upload-" + uuid.uuid4().hex[:8]
    db.upsert_mail(mid, MAILBOX, body.eml, True, db.now())
    return {"id": mid}


def _analyze_text(text: str) -> dict:
    if text.lstrip().lower().startswith(("from:", "received:", "return-path:", "delivered-to:")):
        msg = mail_an.parse(text)
    else:
        msg = EmailMessage()
        msg["Subject"] = "Wklejona wiadomość"
        msg.set_content(text)
    org = db.get_org()
    return mail_an.analyze(msg, org, org_mod.first_name(org_mod.mailbox_owner(org)))


@router.post("/analyze-message")
async def analyze_text(body: AnalyzeText):
    return await run_in_threadpool(_analyze_text, body.text)
