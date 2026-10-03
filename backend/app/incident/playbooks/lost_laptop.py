"""A company laptop was lost or stolen."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "lost_laptop"
LABEL = "Zgubiony lub skradziony laptop"

STOLEN, LOST = "stolen", "lost"

QUESTIONS = [
    {"id": "encrypted", "text": "Czy dysk laptopa był zaszyfrowany (BitLocker albo FileVault)?", "options": YES_NO},
    {"id": "unlocked", "text": "Czy laptop był włączony i odblokowany, gdy zniknął?", "options": YES_NO},
    {"id": "how", "text": "Laptop zginął czy został skradziony?",
     "options": [(STOLEN, "Skradziony"), (LOST, "Zgubiony"), (UNKNOWN, "Nie wiadomo")]},
    {"id": "data", "text": "Czy na laptopie były dane osobowe klientów?", "options": YES_NO},
]

FACTS = {
    ("encrypted", YES): ("confirmed", "Dysk laptopa był zaszyfrowany."),
    ("encrypted", NO): ("confirmed", "Dysk laptopa nie był zaszyfrowany."),
    ("encrypted", UNKNOWN): ("unverified", "Nie wiadomo, czy dysk był zaszyfrowany."),
    ("unlocked", YES): ("confirmed", "Laptop był włączony i odblokowany."),
    ("unlocked", NO): ("confirmed", "Laptop był wyłączony albo zablokowany."),
    ("unlocked", UNKNOWN): ("unverified", "Nie wiadomo, czy laptop był odblokowany."),
    ("how", STOLEN): ("confirmed", "Laptop został skradziony."),
    ("how", LOST): ("confirmed", "Laptop zginął, kradzieży nie stwierdzono."),
    ("how", UNKNOWN): ("unverified", "Nie wiadomo, czy to kradzież."),
    ("data", YES): ("confirmed", "Na laptopie były dane osobowe klientów."),
    ("data", NO): ("confirmed", "Na laptopie nie było danych klientów."),
    ("data", UNKNOWN): ("unverified", "Nie wiadomo, jakie dane były na laptopie."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    encrypted, unlocked = answers.get("encrypted", UNKNOWN), answers.get("unlocked", UNKNOWN)
    if encrypted == NO or unlocked == YES:
        exposed, safe = "likely", "unlikely"
    elif encrypted == YES and unlocked == NO:
        exposed, safe = "unlikely", "likely"
    else:
        exposed, safe = "possible", "possible"
    return {
        "safe": hypothesis(
            "Dane chronione szyfrowaniem", safe,
            "Zaszyfrowany i zablokowany laptop jest dla znalazcy bezużyteczny bez hasła.",
            why([(encrypted == YES, "dysk był zaszyfrowany"), (unlocked == NO, "laptop był wyłączony albo zablokowany")]),
            None),
        "exposed": hypothesis(
            "Dane mogą być w obcych rękach", exposed,
            "Bez szyfrowania albo na odblokowanym laptopie obca osoba może przeczytać pliki i wejść na zalogowane konta.",
            why([(encrypted == NO, "dysk nie był zaszyfrowany"), (unlocked == YES, "laptop był odblokowany")]),
            "Kret ostrzegał: dyski laptopów nie są zaszyfrowane." if safeguard_missing(org, "disk_encryption") else None),
    }


ACTIONS = [
    {"id": "remote_lock", "phase": "stop", "title": "Zablokuj laptopa zdalnie i spróbuj go zlokalizować",
     "detail": "Użyj „Znajdź mój Mac” albo „Znajdź moje urządzenie” w Windows, jeśli były włączone. Zablokuj ekran z komunikatem o kontakcie.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "change_passwords", "phase": "stop", "title": "Zmień hasła do kont używanych na laptopie",
     "detail": "Poczta, chmura, bank i menedżer haseł. Zmieniaj z innego urządzenia, zaczynając od poczty.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "signout", "phase": "stop", "title": "Wyloguj laptopa ze wszystkich kont",
     "detail": "W ustawieniach konta Google albo Microsoft usuń to urządzenie z zaufanych i zakończ jego sesje.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "bank", "phase": "stop", "title": "Powiadom bank, jeśli laptop miał dostęp do konta firmy",
     "detail": "Bank zablokuje zapamiętane sesje i urządzenie zaufane do autoryzacji przelewów.",
     "role": "finance", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "spare", "phase": "continue", "title": "Przygotuj laptop zastępczy",
     "detail": "Odtwórz pliki z kopii albo chmury i zaloguj się nowymi hasłami.",
     "role": "it", "priority": "1h", "safe_any_cause": True, "when": lambda c: True},
    {"id": "police", "phase": "notify", "title": "Zgłoś kradzież na policję",
     "detail": "Podaj numer seryjny laptopa. Potwierdzenie zgłoszenia przyda się ubezpieczycielowi.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "how") != LOST},
    {"id": "remote_wipe", "phase": "stop", "title": "Wymaż laptopa zdalnie",
     "detail": "Gdy nie ma szans na odzyskanie, a dane mogą być w obcych rękach, zdalne wymazanie zamyka sprawę danych na dysku.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "exposed") != "unlikely"},
    {"id": "assess_data", "phase": "assess", "title": "Ustal, jakie dane były na laptopie",
     "detail": "Pliki klientów, zapisane hasła w przeglądarce, dostęp do poczty i chmury. Od tego zależy zgłoszenie do UODO.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Zgłoś naruszenie do UODO w ciągu 72 godzin",
     "detail": "Dane klientów mogą być w obcych rękach. Zgłoszenie przez biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "data") == YES and lvl(c, "exposed") != "unlikely"},
    {"id": "inform_clients", "phase": "notify", "title": "Poinformuj klientów, których dane mogły wyciec",
     "detail": "Gdy wyciek może im zaszkodzić, trzeba ich uprzedzić: co się stało i na co uważać. Gotowy tekst poniżej.",
     "role": "office", "priority": "1h", "safe_any_cause": False,
     "when": lambda c: answer(c, "data") == YES and lvl(c, "exposed") == "likely"},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Nasza firma"
    boss = boss_name(org)
    return [
        {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
         "text": "Zginął służbowy laptop. Zmieniamy hasła do poczty, chmury i banku, które były na nim używane. "
                 f"Jeśli ktoś znajdzie laptopa, niech go nie włącza i odda informatykowi.{f' Koordynuje {boss}.' if boss else ''}"},
        {"id": "sms_clients", "channel": "Wiadomość do klientów",
         "text": f"{name}: zginął nasz służbowy laptop. Zabezpieczyliśmy konta i zgłosiliśmy sprawę. Jeśli dostaniesz nietypową wiadomość "
                 f"w naszym imieniu, zwłaszcza z prośbą o przelew, {phone_line(org)}"},
    ]


LESSONS = ["disk_encryption", "m365_mfa", "backup_offline"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES and hyp["exposed"]["level"] != "unlikely"


def impact(answers: dict) -> dict:
    return {"untrusted": ["komputery", "konta"], "at_risk": ["client_data_read"],
            "note": "Zaginiony laptop i jego konta: niezaufane. Nowe hasła i wylogowane sesje odcinają od nich dostęp."}
