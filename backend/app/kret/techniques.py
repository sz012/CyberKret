"""Attack techniques the kret simulates on the organization map.

A technique works when every safeguard in `requires_missing` is absent. An empty list means it always works
once the attacker stands at `src` (e.g. a mailbox owner can always read files on its drive).
`chamber` is where the weakness lives on the map; the tunnel is drawn through it.
"""

ENTRY = "internet"

POSITIONS = {
    "internet": "Internet",
    "rdp_session": "Pulpit komputera szefa",
    "admin_all_pcs": "Administrator na wszystkich komputerach",
    "m365_account": "Konto Microsoft 365 księgowości",
    "email_spoof": "Fałszywy mail „od kancelarii” lub kontrahenta",
    "client_data_read": "Akta klientów",
    "money_stolen": "Pieniądze",
    "operations_stopped": "Praca kancelarii",
}

TECHNIQUES = [
    {
        "id": "T1", "name": "Otwarty pulpit zdalny",
        "src": ["internet"], "dst": "rdp_session", "chamber": "siec",
        "requires_missing": ["router_no_rdp"],
        "narration": "Wchodzę z internetu prosto na pulpit komputera szefa, bo router wystawia port 3389. Boty próbują takich drzwi co kilka minut.",
    },
    {
        "id": "T2", "name": "Wspólne hasło administratora",
        "src": ["rdp_session"], "dst": "admin_all_pcs", "chamber": "komputery",
        "requires_missing": ["unique_admin_passwords"],
        "narration": "Na komputerze szefa wyciągam hasło konta „admin”. Pasuje do sekretariatu i księgowości, więc mam wszystkie trzy.",
    },
    {
        "id": "T3", "name": "Phishing na konto bez MFA",
        "src": ["internet"], "dst": "m365_account", "chamber": "konta",
        "requires_missing": ["m365_mfa"],
        "narration": "Wysyłam księgowości fałszywą stronę logowania do Microsoft 365. Wystarczy samo hasło, bo konto nie ma drugiego kroku.",
    },
    {
        "id": "T4", "name": "Podszycie pod domenę",
        "src": ["internet"], "dst": "email_spoof", "chamber": "poczta",
        "requires_missing": ["domain_dmarc"],
        "narration": "Piszę maila jako kancelaria albo jej kontrahent. Bez DMARC skrzynki odbiorców nie mają podstaw, żeby go odrzucić.",
    },
    {
        "id": "T5", "name": "Pliki na koncie",
        "src": ["m365_account"], "dst": "client_data_read", "chamber": "konta",
        "requires_missing": [],
        "narration": "Z przejętego konta otwieram OneDrive i SharePoint. Akta klientów są w środku.",
    },
    {
        "id": "T6", "name": "Dyski stanowisk",
        "src": ["admin_all_pcs"], "dst": "client_data_read", "chamber": "komputery",
        "requires_missing": [],
        "narration": "Jako administrator kopiuję akta z dysków i z zamapowanego serwera plików.",
    },
    {
        "id": "T7", "name": "Szyfrowanie razem z kopiami",
        "src": ["admin_all_pcs"], "dst": "operations_stopped", "chamber": "kopie",
        "requires_missing": ["backup_offline"],
        "narration": "Uruchamiam ransomware na wszystkich komputerach. Kopia jest stale podpięta jako dysk Z:, więc szyfruje się razem z resztą.",
    },
    {
        "id": "T8", "name": "Fałszywy numer konta",
        "src": ["m365_account", "email_spoof"], "dst": "money_stolen", "chamber": "procedury",
        "requires_missing": ["payment_callback_rule"],
        "narration": "Proszę księgowość o „nowy numer rachunku” do faktury. Nikt nie dzwoni, żeby to potwierdzić, więc przelew idzie do mnie.",
    },
]

TECHNIQUES_BY_ID = {t["id"]: t for t in TECHNIQUES}
