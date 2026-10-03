"""Attack techniques the kret simulates on the organization map.

A technique works when every safeguard in `requires_missing` is absent. An empty list means it always works
once the attacker stands at `src` (e.g. a mailbox owner can always read files on its drive).
`chamber` is where the weakness lives on the map; the tunnel is drawn through it.
"""

ENTRY = "internet"

POSITIONS = {
    "internet": "Internet",
    "rdp_session": "Komputer z otwartym pulpitem zdalnym",
    "admin_all_pcs": "Administrator na wszystkich komputerach",
    "m365_account": "Przejęte konto pocztowe",
    "email_spoof": "Fałszywy mail od firmy lub kontrahenta",
    "client_data_read": "Dane klientów",
    "money_stolen": "Pieniądze",
    "operations_stopped": "Praca firmy",
}

TECHNIQUES = [
    {
        "id": "T1", "name": "Otwarty pulpit zdalny",
        "src": ["internet"], "dst": "rdp_session", "chamber": "siec",
        "requires_missing": ["router_no_rdp"],
        "narration": "Wchodzę z internetu prosto na pulpit komputera, bo router wystawia port 3389. Boty próbują takich drzwi co kilka minut.",
    },
    {
        "id": "T2", "name": "Wspólne hasło administratora",
        "src": ["rdp_session"], "dst": "admin_all_pcs", "chamber": "komputery",
        "requires_missing": ["unique_admin_passwords"],
        "narration": "Na tym komputerze wyciągam hasło konta administratora. Pasuje też do pozostałych komputerów, więc mam je wszystkie.",
    },
    {
        "id": "T3", "name": "Phishing na konto bez MFA",
        "src": ["internet"], "dst": "m365_account", "chamber": "konta",
        "requires_missing": ["m365_mfa"],
        "narration": "Wysyłam osobie od faktur fałszywą stronę logowania do poczty. Wystarczy samo hasło, bo konto nie ma drugiego kroku.",
    },
    {
        "id": "T4", "name": "Podszycie pod domenę",
        "src": ["internet"], "dst": "email_spoof", "chamber": "poczta",
        "requires_missing": ["domain_dmarc"],
        "narration": "Piszę maila jako Twoja firma albo jej kontrahent. Bez DMARC skrzynki odbiorców nie mają podstaw, żeby go odrzucić.",
    },
    {
        "id": "T5", "name": "Pliki na koncie",
        "src": ["m365_account"], "dst": "client_data_read", "chamber": "konta",
        "requires_missing": [],
        "narration": "Z przejętego konta otwieram pliki w chmurze. Dane klientów są w środku.",
    },
    {
        "id": "T6", "name": "Dyski stanowisk",
        "src": ["admin_all_pcs"], "dst": "client_data_read", "chamber": "komputery",
        "requires_missing": [],
        "narration": "Jako administrator kopiuję dane klientów z dysków i z udziałów sieciowych.",
    },
    {
        "id": "T7", "name": "Szyfrowanie razem z kopiami",
        "src": ["admin_all_pcs"], "dst": "operations_stopped", "chamber": "kopie",
        "requires_missing": ["backup_offline"],
        "narration": "Uruchamiam ransomware na wszystkich komputerach. Kopia jest stale podpięta do sieci, więc szyfruje się razem z resztą.",
    },
    {
        "id": "T8", "name": "Fałszywy numer konta",
        "src": ["m365_account", "email_spoof"], "dst": "money_stolen", "chamber": "procedury",
        "requires_missing": ["payment_callback_rule"],
        "narration": "Proszę osobę od płatności o nowy numer rachunku do faktury. Nikt nie dzwoni, żeby to potwierdzić, więc przelew idzie do mnie.",
    },
]

TECHNIQUES_BY_ID = {t["id"]: t for t in TECHNIQUES}
