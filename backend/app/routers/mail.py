import json
import uuid
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from .. import db
from ..mail import analyze as mail_an
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
    return {"mailbox": MAILBOX, "owner": "Grażyna Kowalska", "messages": [_row_summary(r) for r in db.list_mail(MAILBOX)]}


@router.get("/mail/{mail_id}")
def message(mail_id: str):
    r = db.get_mail(mail_id)
    if not r:
        raise HTTPException(404, "Nie ma takiego maila")
    s = mail_an.summarize(mail_an.parse(r["eml"]))
    s.pop("html")
    return {"id": r["id"], "received_at": r["received_at"], **s,
            "analysis": json.loads(r["analysis_json"]) if r["analysis_json"] else None}


def _scan(mail_id: str) -> dict:
    r = db.get_mail(mail_id)
    if not r:
        raise HTTPException(404, "Nie ma takiego maila")
    result = mail_an.analyze(mail_an.parse(r["eml"]), db.get_org(), recipient_name="Pani Grażyna")
    db.save_mail_analysis(mail_id, result)
    return result


@router.post("/mail/{mail_id}/scan")
async def scan(mail_id: str):
    return await run_in_threadpool(_scan, mail_id)


@router.post("/mail/deliver-next")
def deliver_next():
    with db.conn() as c:
        r = c.execute("SELECT id FROM mail WHERE mailbox = ? AND delivered = 0 ORDER BY id LIMIT 1", (MAILBOX,)).fetchone()
    if not r:
        raise HTTPException(409, "Brak kolejnych maili w scenariuszu demo")
    db.deliver_mail(r["id"])
    return {"id": r["id"]}


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
    return mail_an.analyze(msg, db.get_org())


@router.post("/analyze-message")
async def analyze_text(body: AnalyzeText):
    return await run_in_threadpool(_analyze_text, body.text)
