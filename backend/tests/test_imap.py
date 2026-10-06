"""Gmail over IMAP: read-only, nothing marked as read, friendly errors."""
import imaplib

from app import config
from app.mail import imap_sync

RAW = (b"From: Hurtownia <faktury@pol-hurt.pl>\r\nTo: biuro@example.pl\r\nSubject: Faktura 10/2026\r\n"
       b"Date: Fri, 02 Oct 2026 09:15:00 +0200\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nW za\xc5\x82\xc4\x85czniku faktura.\r\n")


class FakeBox:
    calls: list = []

    def __init__(self, host, port, timeout=None):
        FakeBox.calls = [("connect", host, port)]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        if password != "dobre-haslo":
            raise imaplib.IMAP4.error(b"[AUTHENTICATIONFAILED] Invalid credentials (Failure)")
        FakeBox.calls.append(("login", user))

    def select(self, folder, readonly=False):
        FakeBox.calls.append(("select", folder, readonly))
        return "OK", [b"2"]

    def response(self, code):
        return code, [b"77"]

    def uid(self, command, *args):
        FakeBox.calls.append((command, *args))
        if command == "search":
            return "OK", [b"5 6"]
        if args[-1] == "(RFC822.SIZE)":
            return "OK", [b"1 (UID 5 RFC822.SIZE 400)", b"2 (UID 6 RFC822.SIZE 400)"]
        return "OK", [(b"1 (UID x BODY[] {400}", RAW), b")"]


def configure(monkeypatch, password="dobre-haslo"):
    monkeypatch.setattr(config, "IMAP_USER", "szymon@gmail.com")
    monkeypatch.setattr(config, "IMAP_PASSWORD", password)
    monkeypatch.setattr(imaplib, "IMAP4_SSL", FakeBox)


def test_sync_stores_new_messages_read_only(client, monkeypatch):
    client.post("/api/org/new", json={"name": "Biuro Testowe"})
    configure(monkeypatch)
    r = client.post("/api/mail/sync").json()
    assert r == {"new": 2, "skipped": 0, "checked": 2}
    assert ("select", '"INBOX"', True) in FakeBox.calls
    assert all(c[-1] == "(BODY.PEEK[])" for c in FakeBox.calls if c[0] == "fetch" and c[-1] != "(RFC822.SIZE)")
    inbox = client.get("/api/mail").json()
    assert {m["id"] for m in inbox["messages"]} == {"imap-77-5", "imap-77-6"}
    assert inbox["imap"]["user"] == "sz…@gmail.com"
    again = client.post("/api/mail/sync").json()
    assert again["new"] == 0
    scan = client.post("/api/mail/imap-77-5/scan").json()
    assert scan["verdict"] == "safe" and scan["llm"]["model"] is None


def test_wrong_password_gives_clear_message(client, monkeypatch):
    configure(monkeypatch, password="zle")
    r = client.post("/api/mail/sync")
    assert r.status_code == 400 and "app password" in r.json()["detail"]


def test_not_configured(client, monkeypatch):
    monkeypatch.setattr(config, "IMAP_USER", "")
    monkeypatch.setattr(config, "IMAP_PASSWORD", "")
    r = client.post("/api/mail/sync")
    assert r.status_code == 400 and ".env.local" in r.json()["detail"]
    assert imap_sync.status()["configured"] is False
