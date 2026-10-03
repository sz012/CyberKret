from .. import org as org_mod
from . import playbook as pb

RULES = [
    "Nie płać na numer konta podany mailem. Zadzwoń do kontrahenta na numer z umowy.",
    "Nie kasuj podejrzanych maili ani żądań okupu. To dowód dla banku, policji i CERT Polska.",
    "Przelew już wyszedł? Dzwoń do banku od razu, liczą się godziny.",
    "Możliwy wyciek danych klientów: 72 godziny na zgłoszenie do UODO od chwili stwierdzenia.",
    "Incydent zgłaszasz do CERT Polska przez incydent.cert.pl.",
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
