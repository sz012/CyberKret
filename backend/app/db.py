"""SQLite storage. Only inputs are stored (map, answers, statuses); kret results and situations are computed."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS organization (id INTEGER PRIMARY KEY, data_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kret_run (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, label TEXT, result_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mail (
  id TEXT PRIMARY KEY, mailbox TEXT NOT NULL, delivered INTEGER NOT NULL, received_at TEXT,
  eml TEXT NOT NULL, analysis_json TEXT
);
CREATE TABLE IF NOT EXISTS incident (
  id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, status TEXT NOT NULL,
  answers_json TEXT NOT NULL, answered_at_json TEXT NOT NULL, action_status_json TEXT NOT NULL,
  confirmations_json TEXT NOT NULL, facts_json TEXT NOT NULL, plan_ids_json TEXT NOT NULL,
  source_mail_id TEXT, created_at TEXT NOT NULL, closed_at TEXT
);
CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, incident_id INTEGER NOT NULL, created_at TEXT NOT NULL,
  kind TEXT NOT NULL, message TEXT NOT NULL
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def conn():
    c = sqlite3.connect(config.DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init() -> None:
    with conn() as c:
        c.executescript(SCHEMA)
    from .routers.demo import reset_if_empty

    reset_if_empty()


# ---------- organization ----------

def get_org() -> dict:
    with conn() as c:
        row = c.execute("SELECT data_json FROM organization WHERE id = 1").fetchone()
    return json.loads(row["data_json"])


def save_org(org: dict) -> None:
    with conn() as c:
        c.execute(
            "INSERT INTO organization (id, data_json, updated_at) VALUES (1, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at",
            (json.dumps(org, ensure_ascii=False), now()),
        )


# ---------- kret runs ----------

def add_run(result: dict, label: str | None = None) -> dict:
    with conn() as c:
        created = now()
        cur = c.execute(
            "INSERT INTO kret_run (created_at, label, result_json) VALUES (?, ?, ?)",
            (created, label, json.dumps(result, ensure_ascii=False)),
        )
        return {**result, "id": cur.lastrowid, "created_at": created, "label": label}


def list_runs(limit: int = 20) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM kret_run ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{**json.loads(r["result_json"]), "id": r["id"], "created_at": r["created_at"], "label": r["label"]} for r in rows]


def get_run(run_id: int) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM kret_run WHERE id = ?", (run_id,)).fetchone()
    if not r:
        return None
    return {**json.loads(r["result_json"]), "id": r["id"], "created_at": r["created_at"], "label": r["label"]}


# ---------- mail ----------

def list_mail(mailbox: str) -> list[sqlite3.Row]:
    with conn() as c:
        return c.execute(
            "SELECT * FROM mail WHERE mailbox = ? AND delivered = 1 ORDER BY received_at DESC", (mailbox,)
        ).fetchall()


def get_mail(mail_id: str) -> sqlite3.Row | None:
    with conn() as c:
        return c.execute("SELECT * FROM mail WHERE id = ?", (mail_id,)).fetchone()


def upsert_mail(mail_id: str, mailbox: str, eml: str, delivered: bool, received_at: str | None) -> None:
    with conn() as c:
        c.execute(
            "INSERT OR REPLACE INTO mail (id, mailbox, delivered, received_at, eml, analysis_json) VALUES (?, ?, ?, ?, ?, NULL)",
            (mail_id, mailbox, int(delivered), received_at, eml),
        )


def deliver_mail(mail_id: str) -> None:
    with conn() as c:
        c.execute("UPDATE mail SET delivered = 1, received_at = ?, analysis_json = NULL WHERE id = ?", (now(), mail_id))


def save_mail_analysis(mail_id: str, analysis: dict) -> None:
    with conn() as c:
        c.execute("UPDATE mail SET analysis_json = ? WHERE id = ?", (json.dumps(analysis, ensure_ascii=False), mail_id))


# ---------- incidents ----------

_INCIDENT_JSON = ("answers", "answered_at", "action_status", "confirmations", "facts", "plan_ids")


def _incident_row(r: sqlite3.Row) -> dict:
    d = dict(r)
    for k in _INCIDENT_JSON:
        d[k] = json.loads(d.pop(f"{k}_json"))
    return d


def create_incident(type_: str, facts: list[dict], source_mail_id: str | None) -> int:
    with conn() as c:
        cur = c.execute(
            "INSERT INTO incident (type, status, answers_json, answered_at_json, action_status_json, confirmations_json, "
            "facts_json, plan_ids_json, source_mail_id, created_at) VALUES (?, 'open', '{}', '{}', '{}', '{}', ?, '[]', ?, ?)",
            (type_, json.dumps(facts, ensure_ascii=False), source_mail_id, now()),
        )
        return cur.lastrowid


def get_incident(incident_id: int) -> dict | None:
    with conn() as c:
        r = c.execute("SELECT * FROM incident WHERE id = ?", (incident_id,)).fetchone()
    return _incident_row(r) if r else None


def list_incidents() -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM incident ORDER BY id DESC").fetchall()
    return [_incident_row(r) for r in rows]


def update_incident(incident_id: int, **fields) -> None:
    sets, vals = [], []
    for k, v in fields.items():
        if k in _INCIDENT_JSON:
            sets.append(f"{k}_json = ?")
            vals.append(json.dumps(v, ensure_ascii=False))
        else:
            sets.append(f"{k} = ?")
            vals.append(v)
    with conn() as c:
        c.execute(f"UPDATE incident SET {', '.join(sets)} WHERE id = ?", (*vals, incident_id))


def add_event(incident_id: int, kind: str, message: str) -> None:
    with conn() as c:
        c.execute(
            "INSERT INTO event_log (incident_id, created_at, kind, message) VALUES (?, ?, ?, ?)",
            (incident_id, now(), kind, message),
        )


def list_events(incident_id: int) -> list[dict]:
    with conn() as c:
        rows = c.execute("SELECT * FROM event_log WHERE incident_id = ? ORDER BY id", (incident_id,)).fetchall()
    return [dict(r) for r in rows]


def wipe() -> None:
    with conn() as c:
        c.executescript(
            "DELETE FROM organization; DELETE FROM kret_run; DELETE FROM mail; DELETE FROM incident; DELETE FROM event_log;"
            "DELETE FROM sqlite_sequence;"
        )
