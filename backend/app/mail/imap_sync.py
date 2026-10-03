"""Read-only IMAP download: messages from the last days land in the local inbox. Nothing is marked as read or sent."""
import imaplib
import re
import socket
import ssl
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from .. import config, db

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MAX_BYTES = 10_000_000


class ImapError(Exception):
    pass


def configured() -> bool:
    return bool(config.IMAP_USER and config.IMAP_PASSWORD)


def masked_user() -> str:
    user = config.IMAP_USER
    if "@" not in user:
        return user[:2] + "…" if user else ""
    name, domain = user.split("@", 1)
    return f"{name[:2]}…@{domain}"


def status() -> dict:
    return {"configured": configured(), "user": masked_user(), "host": config.IMAP_HOST, "days": config.IMAP_DAYS}


def _since(days: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}"


def _received(raw: bytes) -> str:
    head = raw[:20_000].decode("utf-8", errors="replace")
    m = re.search(r"^Date:\s*(.+)$", head, re.M | re.I)
    try:
        if m:
            return parsedate_to_datetime(m.group(1).strip()).astimezone(timezone.utc).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        pass
    return db.now()


def _sizes(box: imaplib.IMAP4, uids: list[bytes]) -> dict[bytes, int]:
    if not uids:
        return {}
    status, data = box.uid("fetch", b",".join(uids), "(RFC822.SIZE)")
    sizes = {}
    if status == "OK":
        for item in data:
            line = item[0] if isinstance(item, tuple) else item
            m = re.search(rb"UID (\d+).*RFC822\.SIZE (\d+)|RFC822\.SIZE (\d+).*UID (\d+)", line or b"")
            if m:
                uid, size = (m.group(1), m.group(2)) if m.group(1) else (m.group(4), m.group(3))
                sizes[uid] = int(size)
    return sizes


def sync(mailbox: str) -> dict:
    if not configured():
        raise ImapError("Skrzynka nie jest podłączona. Uzupełnij IMAP_USER i IMAP_PASSWORD w pliku .env.local i uruchom backend ponownie.")
    new = skipped = 0
    try:
        with imaplib.IMAP4_SSL(config.IMAP_HOST, config.IMAP_PORT, timeout=20) as box:
            box.login(config.IMAP_USER, config.IMAP_PASSWORD)
            status, _ = box.select(f'"{config.IMAP_FOLDER}"', readonly=True)
            if status != "OK":
                raise ImapError(f"Nie ma folderu {config.IMAP_FOLDER}. Sprawdź IMAP_FOLDER w pliku .env.local.")
            validity = (box.response("UIDVALIDITY")[1] or [b"0"])[0].decode()
            status, data = box.uid("search", None, "SINCE", _since(config.IMAP_DAYS))
            uids = data[0].split()[-config.IMAP_LIMIT:] if status == "OK" and data and data[0] else []
            fresh = [u for u in uids if not db.get_mail(f"imap-{validity}-{u.decode()}")]
            sizes = _sizes(box, fresh)
            for uid in fresh:
                if sizes.get(uid, 0) > MAX_BYTES:
                    skipped += 1
                    continue
                status, parts = box.uid("fetch", uid, "(BODY.PEEK[])")
                raw = next((p[1] for p in parts if isinstance(p, tuple) and isinstance(p[1], bytes)), None) if status == "OK" else None
                if not raw:
                    skipped += 1
                    continue
                db.upsert_mail(f"imap-{validity}-{uid.decode()}", mailbox, raw.decode("utf-8", errors="replace"), True, _received(raw))
                new += 1
    except imaplib.IMAP4.error as e:
        text = str(e).lower()
        if "authenticationfailed" in text or "invalid credentials" in text or "login" in text:
            raise ImapError("Serwer poczty odrzucił logowanie. Sprawdź adres i hasło aplikacji w pliku .env.local.") from None
        raise ImapError("Serwer poczty odrzucił polecenie. Spróbuj ponownie za chwilę.") from None
    except (OSError, ssl.SSLError, socket.timeout):
        raise ImapError(f"Nie udało się połączyć z {config.IMAP_HOST}. Sprawdź internet i ustawienie IMAP_HOST.") from None
    return {"new": new, "skipped": skipped, "checked": len(uids)}
