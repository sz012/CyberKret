import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .schemas import KretResult, KretRunSummary, LogEntry, Organization

SCHEMA = """
CREATE TABLE IF NOT EXISTS organization (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS kret_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS incident (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    answers TEXT NOT NULL,
    answered_at TEXT NOT NULL,
    action_status TEXT NOT NULL,
    confirmations TEXT NOT NULL,
    facts TEXT NOT NULL,
    created_at TEXT NOT NULL,
    closed_at TEXT
);
CREATE TABLE IF NOT EXISTS event_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    incident_id INTEGER,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    message TEXT NOT NULL
);
"""

JSON_COLUMNS = ("answers", "answered_at", "action_status", "confirmations", "facts")
UPDATABLE_COLUMNS = {*JSON_COLUMNS, "status", "closed_at"}


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


@dataclass
class IncidentRecord:
    id: int
    org_id: str
    type: str
    status: str
    answers: dict[str, str]
    answered_at: dict[str, str]
    action_status: dict[str, str]
    confirmations: dict[str, bool]
    facts: list[str]
    created_at: str
    closed_at: str | None


class Store:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def init(self, seed: Organization) -> None:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as conn:
            conn.executescript(SCHEMA)
            if conn.execute("SELECT 1 FROM organization LIMIT 1").fetchone() is None:
                self._insert_org(conn, seed)

    def reset(self, seed: Organization) -> None:
        with self._connect() as conn:
            for table in ("event_log", "incident", "kret_run", "organization"):
                conn.execute(f"DELETE FROM {table}")
            conn.execute("DELETE FROM sqlite_sequence")
            self._insert_org(conn, seed)

    def _insert_org(self, conn: sqlite3.Connection, org: Organization) -> None:
        conn.execute(
            "INSERT INTO organization (id, data, updated_at) VALUES (?, ?, ?)",
            (org.id, org.model_dump_json(), now_iso()),
        )

    def get_org(self) -> Organization:
        with self._connect() as conn:
            row = conn.execute("SELECT data FROM organization ORDER BY rowid LIMIT 1").fetchone()
        if row is None:
            raise LookupError("organization missing")
        return Organization.model_validate_json(row["data"])

    def save_org(self, org: Organization) -> None:
        with self._connect() as conn:
            conn.execute(
                "UPDATE organization SET data = ?, updated_at = ? WHERE id = ?",
                (org.model_dump_json(), now_iso(), org.id),
            )

    def add_kret_run(self, org_id: str, result: KretResult) -> KretResult:
        with self._connect() as conn:
            cursor = conn.execute(
                "INSERT INTO kret_run (org_id, created_at, result) VALUES (?, ?, ?)",
                (org_id, result.created_at, result.model_dump_json()),
            )
            run_id = cursor.lastrowid
        return result.model_copy(update={"id": run_id})

    def latest_kret_run(self) -> KretResult | None:
        with self._connect() as conn:
            row = conn.execute("SELECT id, result FROM kret_run ORDER BY id DESC LIMIT 1").fetchone()
        if row is None:
            return None
        return KretResult.model_validate_json(row["result"]).model_copy(update={"id": row["id"]})

    def list_kret_runs(self, limit: int = 20) -> list[KretRunSummary]:
        with self._connect() as conn:
            rows = conn.execute("SELECT id, result FROM kret_run ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        summaries = []
        for row in rows:
            result = KretResult.model_validate_json(row["result"])
            summaries.append(
                KretRunSummary(
                    id=row["id"],
                    created_at=result.created_at,
                    total=result.total,
                    remaining_after_moves=result.remaining_after_moves,
                )
            )
        return summaries

    def create_incident(self, org_id: str, type_: str, answers: dict[str, str], facts: list[str]) -> int:
        created = now_iso()
        with self._connect() as conn:
            cursor = conn.execute(
                """INSERT INTO incident (org_id, type, status, answers, answered_at, action_status,
                   confirmations, facts, created_at) VALUES (?, ?, 'open', ?, ?, '{}', '{}', ?, ?)""",
                (
                    org_id,
                    type_,
                    json.dumps(answers, ensure_ascii=False),
                    json.dumps(dict.fromkeys(answers, created)),
                    json.dumps(facts, ensure_ascii=False),
                    created,
                ),
            )
            return int(cursor.lastrowid or 0)

    def get_incident(self, incident_id: int) -> IncidentRecord | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM incident WHERE id = ?", (incident_id,)).fetchone()
        return self._to_record(row) if row else None

    def list_incidents(self) -> list[IncidentRecord]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM incident ORDER BY id DESC").fetchall()
        return [self._to_record(row) for row in rows]

    def update_incident(self, incident_id: int, **fields: Any) -> None:
        unknown = set(fields) - UPDATABLE_COLUMNS
        if unknown:
            raise ValueError(f"unknown columns: {sorted(unknown)}")
        assignments = ", ".join(f"{name} = ?" for name in fields)
        values = [
            json.dumps(value, ensure_ascii=False) if name in JSON_COLUMNS else value for name, value in fields.items()
        ]
        with self._connect() as conn:
            conn.execute(f"UPDATE incident SET {assignments} WHERE id = ?", (*values, incident_id))

    def log(self, kind: str, message: str, incident_id: int | None = None) -> None:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO event_log (incident_id, created_at, kind, message) VALUES (?, ?, ?, ?)",
                (incident_id, now_iso(), kind, message),
            )

    def list_log(self, incident_id: int | None = None, limit: int = 100, newest_first: bool = True) -> list[LogEntry]:
        order = "DESC" if newest_first else "ASC"
        query = "SELECT * FROM event_log"
        params: tuple[Any, ...] = ()
        if incident_id is not None:
            query += " WHERE incident_id = ?"
            params = (incident_id,)
        query += f" ORDER BY id {order} LIMIT ?"
        with self._connect() as conn:
            rows = conn.execute(query, (*params, limit)).fetchall()
        return [LogEntry(**dict(row)) for row in rows]

    @staticmethod
    def _to_record(row: sqlite3.Row) -> IncidentRecord:
        data = dict(row)
        for column in JSON_COLUMNS:
            data[column] = json.loads(data[column])
        return IncidentRecord(**data)
