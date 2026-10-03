"""Suspicious payment request or fake invoice (business email compromise)."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "fake_invoice"
LABEL = "Fałszywa faktura lub prośba o zmianę numeru konta"

QUESTIONS = [
    {"id": "paid", "text": "Czy ktoś już zapłacił na nowy numer konta?",
     "options": [(YES, "Tak, przelew wyszedł"), (NO, "Nie"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "sent", "text": "Czy w folderze Wysłane są maile, których nikt z nas nie pisał?",
     "options": [(YES, "Tak"), (NO, "Nie"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "clicked", "text": "Czy ktoś kliknął link albo wpisał hasło po tym mailu?", "options": YES_NO},
    {"id": "clients", "text": "Czy ktoś niepowołany mógł zobaczyć dane klientów?", "options": YES_NO},
]

FACTS = {
    ("paid", YES): ("confirmed", "Przelew na numer oszusta już wyszedł."),
    ("paid", NO): ("confirmed", "Nikt nie zapłacił na nowy numer."),
    ("paid", UNKNOWN): ("unverified", "Nie wiadomo, czy ktoś zapłacił."),
    ("sent", YES): ("confirmed", "W Wysłanych są maile, których nikt nie pisał."),
    ("sent", NO): ("confirmed", "W Wysłanych nie ma obcych maili."),
    ("sent", UNKNOWN): ("unverified", "Nikt jeszcze nie sprawdził folderu Wysłane."),
    ("clicked", YES): ("confirmed", "Ktoś kliknął link lub wpisał hasło."),
    ("clicked", NO): ("confirmed", "Nikt nie klikał linków ani nie wpisywał hasła."),
    ("clicked", UNKNOWN): ("unverified", "Nie wiadomo, czy ktoś kliknął link."),
    ("clients", YES): ("confirmed", "Ktoś niepowołany mógł zobaczyć dane klientów."),
    ("clients", NO): ("confirmed", "Dane klientów nie były narażone."),
    ("clients", UNKNOWN): ("unverified", "Nie wiadomo, czy dane klientów były narażone."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    sent, clicked = answers.get("sent", UNKNOWN), answers.get("clicked", UNKNOWN)
    lookalike = any(f.get("type") in ("lookalike_sender", "reply_to_mismatch") for f in facts)

    if sent == YES or clicked == YES:
        takeover = "likely"
    elif sent == NO and clicked == NO:
        takeover = "unlikely"
    else:
        takeover = "possible"

    if takeover == "likely":
        spoof = "possible" if lookalike else "unlikely"
    elif lookalike or sent == NO:
        spoof = "likely"
    else:
        spoof = "possible"

    return {
        "spoof": hypothesis(
            "Podszycie z zewnątrz", spoof,
            "Oszust pisze z podobnej domeny albo udaje naszą firmę. Nasza skrzynka jest cała.",
            why([(lookalike, "kret pocztowy: domena nadawcy udaje znanego kontrahenta"), (sent == NO, "w Wysłanych nie ma obcych maili")]),
            "Kret ostrzegał: domena firmy nie ma DMARC." if safeguard_missing(org, "domain_dmarc") else None),
        "takeover": hypothesis(
            "Przejęte konto pocztowe", takeover,
            "Oszust zalogował się na nasze konto i pisze z niego.",
            why([(sent == YES, "w Wysłanych są obce maile"), (clicked == YES, "ktoś wpisał hasło"), (sent == UNKNOWN, "folder Wysłane niesprawdzony")]),
            "Kret ostrzegał: konta pocztowe nie mają logowania dwuetapowego." if safeguard_missing(org, "m365_mfa") else None),
    }


ACTIONS = [
    {"id": "hold_payments", "phase": "stop", "title": "Wstrzymaj przelewy na nowe numery kont",
     "detail": "Żaden przelew na numer podany mailem nie wychodzi, dopóki ktoś nie potwierdzi go telefonicznie.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "call_vendor", "phase": "assess", "title": "Zadzwoń do kontrahenta na numer z umowy",
     "detail": "Nie na numer z maila. Zapytaj, czy naprawdę zmienili konto.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "keep_evidence", "phase": "assess", "title": "Nie kasuj maila, to dowód",
     "detail": "Kret zapisał kopię z nagłówkami. Przyda się bankowi, policji i CERT Polska.",
     "role": "all", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "untrusted_mail", "phase": "continue", "title": "Ważne sprawy tylko telefonicznie",
     "detail": "Do odwołania poczta jest niezaufana: potwierdzenia, terminy i płatności załatwiamy telefonem.",
     "role": "office", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "bank_recall", "phase": "stop", "title": "Dzwoń do banku: zatrzymanie przelewu",
     "detail": "Poproś o wstrzymanie lub zwrot przelewu (recall). Liczą się godziny. Podaj numer konta oszusta.",
     "role": "finance", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "paid") == YES},
    {"id": "police", "phase": "notify", "title": "Zgłoś oszustwo na policję",
     "detail": "Weź wydruk maila z nagłówkami i potwierdzenie przelewu. Bank może o to poprosić.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "paid") == YES},
    {"id": "check_payments", "phase": "assess", "title": "Sprawdź w banku przelewy z ostatnich 7 dni",
     "detail": "Szukaj przelewów na numery, które pojawiły się pierwszy raz.",
     "role": "finance", "priority": "now", "safe_any_cause": True, "when": lambda c: answer(c, "paid") == UNKNOWN},
    {"id": "reset_password", "phase": "stop", "title": "Zmień hasło do poczty z innego urządzenia",
     "detail": "Nie z komputera, na którym otwarto maila.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "signout", "phase": "stop", "title": "Wyloguj konto pocztowe ze wszystkich urządzeń",
     "detail": "W panelu administratora poczty (Google albo Microsoft) zakończ wszystkie aktywne sesje.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "inbox_rules", "phase": "stop", "title": "Sprawdź reguły przekierowania w skrzynce",
     "detail": "Oszuści dodają regułę, która chowa odpowiedzi kontrahentów. Usuń nieznane reguły.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "enable_mfa", "phase": "stop", "title": "Włącz logowanie dwuetapowe (MFA) na kontach pocztowych",
     "detail": "Bez drugiego kroku do przejęcia konta wystarczy samo hasło.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: lvl(c, "takeover") != "unlikely"},
    {"id": "report_cert", "phase": "notify", "title": "Zgłoś fałszywą domenę do CERT Polska",
     "detail": "incydent.cert.pl. CERT może zablokować domenę oszusta, zanim trafi do innych firm.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},
    {"id": "add_dmarc", "phase": "stop", "title": "Dodaj rekord DMARC dla domeny firmy",
     "detail": "Dzięki niemu nikt nie wyśle maila, który wygląda, jakby przyszedł od Twojej firmy.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "spoof") != "unlikely"},
    {"id": "warn_clients", "phase": "notify", "title": "Ostrzeż klientów innym kanałem",
     "detail": "SMS lub telefon: firma nigdy nie zmienia numeru konta mailem. Gotowy tekst poniżej.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "sent") in (YES, UNKNOWN) or answer(c, "clients") in (YES, UNKNOWN)},
    {"id": "verify_access", "phase": "assess", "title": "Ustal, czy ktoś obcy widział dane klientów",
     "detail": "Informatyk sprawdza historię logowań do poczty z ostatnich 30 dni.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "clients") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Zgłoś naruszenie do UODO w ciągu 72 godzin",
     "detail": "Termin liczy się od chwili stwierdzenia naruszenia. Zgłoszenie przez biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "clients") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Nasza firma"
    sender = next((f.get("quote") for f in facts if f.get("type") == "lookalike_sender" and f.get("quote")), None)
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "SMS do klientów",
         "text": f"{name}: ktoś podszywa się pod nas lub naszych kontrahentów w mailach. Nigdy nie zmieniamy numeru konta mailem. "
                 f"W razie wątpliwości {phone_line(org)}"},
        {"id": "web_notice", "channel": "Komunikat na stronę WWW",
         "text": "Uwaga na fałszywe maile. Otrzymujemy sygnały o wiadomościach podszywających się pod naszą firmę i naszych kontrahentów. "
                 "Numery naszych rachunków się nie zmieniły. Każdą zmianę potwierdzamy telefonicznie."},
        {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
         "text": f"Incydent: fałszywa faktura{f' z domeny {sender}' if sender else ''}. Do odwołania: zero przelewów na nowe numery, "
                 f"ważne sprawy telefonicznie, nie kasujcie podejrzanych maili.{f' Koordynuje {boss}.' if boss else ''}"},
    ]


LESSONS = ["payment_callback_rule", "domain_dmarc", "m365_mfa"]
UODO_QUESTION = "clients"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("clients") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["poczta", "konta"], "at_risk": ["procedury", "client_data_read", "money_stolen"],
            "note": "Poczta i konta: niezaufane. Dopóki informatyk nie potwierdzi, że skrzynka jest czysta, nie potwierdzamy niczego mailem."}
