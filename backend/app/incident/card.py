from . import playbook as pb

RULES = [
    "Nie płać na numer konta podany mailem. Zadzwoń do kontrahenta na numer z umowy.",
    "Nie kasuj podejrzanych maili. To dowód dla banku, policji i CERT Polska.",
    "Przelew już wyszedł? Dzwoń do banku od razu, liczą się godziny.",
    "Możliwy wyciek danych klientów: 72 godziny na zgłoszenie do UODO od chwili stwierdzenia.",
    "Incydent zgłaszasz do CERT Polska przez incydent.cert.pl.",
]


def emergency_card(org: dict) -> dict:
    return {
        "org": org["name"],
        "people": org.get("people", []),
        "fallbacks": org.get("fallbacks", []),
        "contacts": [c for c in org.get("contacts", []) if c.get("phone")],
        "first_steps": [
            {"title": a["title"], "detail": a["detail"], "role": pb.ROLES[a["role"]]}
            for a in pb.ACTIONS
            if a["safe_any_cause"]
        ],
        "rules": RULES,
    }
