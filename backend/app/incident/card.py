from .. import org as org_mod
from . import playbook as pb

RULES = [
    "Never pay to an account number sent by email. Call the vendor on the number from the contract.",
    "Do not delete suspicious emails or ransom notes. They are evidence for the bank, the police and CERT.",
    "Has the payment already gone out? Call the bank right away, hours matter.",
    "Possible leak of client data: 72 hours to notify the data protection authority (UODO in Poland) from the moment you know.",
    "Report the incident to your national CERT (in Poland: CERT Polska, incydent.cert.pl).",
]


def _steps(org: dict, book, limit: int | None = None) -> list[dict]:
    safe = [a for a in book.ACTIONS if a["safe_any_cause"]]
    return [{"title": a["title"], "detail": a["detail"], "role": org_mod.role_label(org, a["role"])} for a in safe[:limit]]


def emergency_card(org: dict) -> dict:
    return {
        "org": org["name"],
        "people": org.get("people", []),
        "fallbacks": org.get("fallbacks", []),
        "contacts": [c for c in org.get("contacts", []) if c.get("phone")],
        "first_steps": _steps(org, pb.get("fake_invoice")),
        "by_type": [{"id": book.ID, "label": book.LABEL, "steps": _steps(org, book, 3)} for book in pb.PLAYBOOKS.values()],
        "rules": RULES,
    }
