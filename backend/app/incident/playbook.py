"""Registry of incident playbooks and what they share: priorities, phases and the 24-hour priority question.

Each playbook module has questions, facts for every answer, hypotheses, actions with `when(ctx)` rules, messages,
lessons, map impact and the data protection authority (UODO) rule. The plan is recomputed from scratch after every new fact.
"""
from types import ModuleType

from .playbooks import account_takeover, fake_invoice, lost_laptop, outage, ransomware
from .playbooks.common import NO, UNKNOWN, YES

__all__ = ["NO", "UNKNOWN", "YES"]

PLAYBOOKS: dict[str, ModuleType] = {p.ID: p for p in (fake_invoice, ransomware, lost_laptop, account_takeover, outage)}

PRIORITY = {"now": "Now", "15min": "Within 15 minutes", "1h": "Within the hour", "verify": "To find out"}

PHASES = [("stop", "Stop"), ("assess", "Assess"), ("notify", "Notify"), ("continue", "Keep running"),
          ("learn", "Learn")]


def get(type_: str) -> ModuleType:
    return PLAYBOOKS[type_]


def types() -> list[dict]:
    return [{"id": p.ID, "label": p.LABEL, "ready": True, "questions": len(p.QUESTIONS) + 1} for p in PLAYBOOKS.values()]


def questions(org: dict, pb: ModuleType) -> list[dict]:
    options = [(c["id"], c["label"]) for c in org.get("continuity", []) if c["id"] != "email"]
    return [*pb.QUESTIONS, {"id": "priority", "text": "What matters most in the next 24 hours?", "options": options}]


def question(org: dict, pb: ModuleType, qid: str) -> dict | None:
    return next((q for q in questions(org, pb) if q["id"] == qid), None)


def action(pb: ModuleType, aid: str) -> dict | None:
    return next((a for a in pb.ACTIONS if a["id"] == aid), None)
