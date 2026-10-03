"""Playbook: suspicious payment request / fake invoice (business email compromise).

Each action has a `when(ctx)` rule. ctx carries answers, hypothesis levels and the org, so the plan is recomputed
from scratch after every new fact. Statuses stay pinned to action ids.
"""

TYPES = {
    "fake_invoice": {"label": "Fałszywa faktura lub prośba o zmianę numeru konta", "ready": True},
    "ransomware": {"label": "Zaszyfrowane pliki (ransomware)", "ready": False},
    "lost_laptop": {"label": "Zgubiony lub skradziony laptop", "ready": False},
    "account_takeover": {"label": "Ktoś zalogował się na nasze konto", "ready": False},
    "outage": {"label": "Nie działa internet lub poczta", "ready": False},
}

YES, NO, UNKNOWN = "yes", "no", "unknown"

QUESTIONS = [
    {"id": "paid", "text": "Czy ktoś już zapłacił na nowy numer konta?",
     "options": [(YES, "Tak, przelew wyszedł"), (NO, "Nie"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "sent", "text": "Czy w folderze Wysłane są maile, których nikt z nas nie pisał?",
     "options": [(YES, "Tak"), (NO, "Nie"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "clicked", "text": "Czy ktoś kliknął link albo wpisał hasło po tym mailu?",
     "options": [(YES, "Tak"), (NO, "Nie"), (UNKNOWN, "Nie wiem")]},
    {"id": "clients", "text": "Czy ktoś niepowołany mógł zobaczyć dane klientów?",
     "options": [(YES, "Tak"), (NO, "Nie"), (UNKNOWN, "Nie wiem")]},
    {"id": "priority", "text": "Co jest najważniejsze w ciągu 24 godzin?",
     "options": [("court", "Termin w sądzie jutro 10:00"), ("payments", "Płatności i faktury"), ("clients", "Kontakt z klientami")]},
]
QUESTIONS_BY_ID = {q["id"]: q for q in QUESTIONS}

PRIORITY = {"now": "Teraz", "15min": "W 15 minut", "1h": "W ciągu godziny", "verify": "Do ustalenia"}

PHASES = [("stop", "Zatrzymaj"), ("assess", "Oceń"), ("notify", "Zawiadom"), ("continue", "Utrzymaj działanie"),
          ("learn", "Wnioski")]

ROLES = {"grazyna": "Grażyna (księgowość)", "piotr": "Piotr (informatyk)", "anna": "Anna (sekretariat)",
         "nowak": "Jan Nowak (szef)", "all": "Wszyscy"}


def lvl(ctx, h):
    return ctx["hyp"][h]["level"]


ACTIONS = [
    # Safe whatever the cause: they go to "Działaj teraz" even while facts are missing.
    {"id": "hold_payments", "phase": "stop", "title": "Wstrzymaj przelewy na nowe numery kont",
     "detail": "Żaden przelew na numer podany mailem nie wychodzi, dopóki ktoś nie potwierdzi go telefonicznie.",
     "role": "grazyna", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "call_vendor", "phase": "assess", "title": "Zadzwoń do kontrahenta na numer z umowy",
     "detail": "Nie na numer z maila. Zapytaj, czy naprawdę zmienili konto.",
     "role": "grazyna", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "keep_evidence", "phase": "assess", "title": "Nie kasuj maila, to dowód",
     "detail": "Kret zapisał kopię z nagłówkami. Przyda się bankowi, policji i CERT Polska.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "untrusted_mail", "phase": "continue", "title": "Ważne sprawy tylko telefonicznie",
     "detail": "Do odwołania poczta jest niezaufana: potwierdzenia, terminy i płatności załatwiamy telefonem.",
     "role": "anna", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},

    # Money already left.
    {"id": "bank_recall", "phase": "stop", "title": "Dzwoń do banku: zatrzymanie przelewu",
     "detail": "Poproś o wstrzymanie lub zwrot przelewu (recall). Liczą się godziny. Podaj numer konta oszusta.",
     "role": "grazyna", "priority": "now", "safe_any_cause": False, "when": lambda c: c["a"].get("paid") == YES},
    {"id": "police", "phase": "notify", "title": "Zgłoś oszustwo na policję",
     "detail": "Weź wydruk maila z nagłówkami i potwierdzenie przelewu. Bank może o to poprosić.",
     "role": "nowak", "priority": "1h", "safe_any_cause": False, "when": lambda c: c["a"].get("paid") == YES},
    {"id": "check_payments", "phase": "assess", "title": "Sprawdź w banku przelewy z ostatnich 7 dni",
     "detail": "Szukaj przelewów na numery, które pojawiły się pierwszy raz.",
     "role": "grazyna", "priority": "now", "safe_any_cause": True, "when": lambda c: c["a"].get("paid", UNKNOWN) == UNKNOWN},

    # Mailbox takeover.
    {"id": "reset_password", "phase": "stop", "title": "Zmień hasło do poczty z innego urządzenia",
     "detail": "Nie z komputera, na którym otwarto maila.",
     "role": "piotr", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "signout", "phase": "stop", "title": "Wyloguj wszystkie sesje w Microsoft 365",
     "detail": "Panel administracyjny → Użytkownicy → Wyloguj ze wszystkich sesji.",
     "role": "piotr", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "inbox_rules", "phase": "stop", "title": "Sprawdź reguły przekierowania w skrzynce",
     "detail": "Oszuści dodają regułę, która chowa odpowiedzi kontrahentów. Usuń nieznane reguły.",
     "role": "piotr", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "enable_mfa", "phase": "stop", "title": "Włącz MFA na koncie księgowości",
     "detail": "Kret ostrzegał: to konto loguje się samym hasłem.",
     "role": "piotr", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},

    # Spoofing from outside.
    {"id": "report_cert", "phase": "notify", "title": "Zgłoś fałszywą domenę do CERT Polska",
     "detail": "incydent.cert.pl. CERT może zablokować domenę oszusta, zanim trafi do innych firm.",
     "role": "anna", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},
    {"id": "add_dmarc", "phase": "stop", "title": "Dodaj rekord DMARC dla domeny kancelarii",
     "detail": "Kret ostrzegał o braku DMARC. Dzięki niemu nikt nie wyśle maila „jako kancelaria”.",
     "role": "piotr", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},

    # Clients.
    {"id": "warn_clients", "phase": "notify", "title": "Ostrzeż klientów innym kanałem",
     "detail": "SMS lub telefon: kancelaria nigdy nie zmienia numeru konta mailem. Gotowy tekst poniżej.",
     "role": "anna", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: c["a"].get("sent", UNKNOWN) in (YES, UNKNOWN) or c["a"].get("clients", UNKNOWN) in (YES, UNKNOWN)},
    {"id": "verify_access", "phase": "assess", "title": "Ustal, czy ktoś obcy widział dane klientów",
     "detail": "Piotr sprawdza logi logowań w Microsoft 365 z ostatnich 30 dni.",
     "role": "nowak", "priority": "verify", "safe_any_cause": False, "when": lambda c: c["a"].get("clients", UNKNOWN) == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Zgłoś naruszenie do UODO w ciągu 72 godzin",
     "detail": "Termin liczy się od chwili stwierdzenia naruszenia. Zgłoszenie przez biznes.gov.pl.",
     "role": "nowak", "priority": "1h", "safe_any_cause": False, "when": lambda c: c["a"].get("clients") == YES},
]
ACTIONS_BY_ID = {a["id"]: a for a in ACTIONS}

CONTINUITY = [
    {"id": "court", "label": "Termin w sądzie jutro 10:00", "critical": True,
     "fallback": "Pismo z kopii offline, wydruk na laptopie zapasowym.",
     "confirmations": [("court_doc", "Pismo wydrukowane z kopii offline"),
                       ("court_folder", "Teczka z pełnomocnictwem gotowa"),
                       ("court_sub", "Zastępstwo na wypadek choroby ustalone")]},
    {"id": "payments", "label": "Płatności i faktury", "critical": True,
     "fallback": "Przelewy tylko po potwierdzeniu telefonicznym.",
     "confirmations": [("pay_hold", "Przelewy na nowe numery wstrzymane"),
                       ("pay_bank", "Bank wie o próbie oszustwa")]},
    {"id": "clients", "label": "Kontakt z klientami", "critical": False,
     "fallback": "Telefon i SMS z numeru kancelarii.",
     "confirmations": [("cl_sms", "Klienci dostali ostrzeżenie SMS"),
                       ("cl_web", "Komunikat na stronie WWW")]},
    {"id": "email", "label": "Poczta", "critical": False,
     "fallback": "Niezaufana do odwołania. Ważne sprawy telefonicznie.",
     "confirmations": [("mail_clean", "Informatyk potwierdził, że skrzynka jest czysta")]},
]

MESSAGES = [
    {"id": "sms_clients", "channel": "SMS do klientów",
     "text": "Kancelaria Nowak: ktoś podszywa się pod naszych kontrahentów w mailach. Nigdy nie zmieniamy numeru konta mailem. W razie wątpliwości prosimy o telefon: 12 000 00 00."},
    {"id": "web_notice", "channel": "Komunikat na stronę WWW",
     "text": "Uwaga na fałszywe maile. Otrzymujemy sygnały o wiadomościach podszywających się pod kancelarię i naszych kontrahentów. Numery naszych rachunków się nie zmieniły. Każdą zmianę potwierdzamy telefonicznie."},
    {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
     "text": "Incydent: fałszywa faktura Biurex. Do odwołania: zero przelewów na nowe numery, ważne sprawy telefonicznie, nie kasujcie podejrzanych maili. Koordynuje Jan Nowak."},
]

# Safeguards the kret proposes to fill after this incident type.
LESSONS = ["payment_callback_rule", "domain_dmarc", "m365_mfa"]
