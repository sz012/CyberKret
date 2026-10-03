"""Internet or mail is down: keep the firm working and rule out an attack."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, why

ID = "outage"
LABEL = "Nie działa internet lub poczta"

NET, MAIL, BOTH = "internet", "mail", "both"
ALL, ONE = "all", "one"

QUESTIONS = [
    {"id": "what", "text": "Co nie działa?",
     "options": [(NET, "Internet"), (MAIL, "Tylko poczta"), (BOTH, "Internet i poczta")]},
    {"id": "scope", "text": "Czy problem dotyczy wszystkich komputerów?",
     "options": [(ALL, "Tak, wszystkich"), (ONE, "Tylko jednego"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "provider", "text": "Czy operator albo dostawca poczty potwierdza awarię?", "options": YES_NO},
    {"id": "signs", "text": "Czy są inne niepokojące objawy: zmienione hasła, okup, dziwne komunikaty?", "options": YES_NO},
]

FACTS = {
    ("what", NET): ("confirmed", "Nie działa internet."),
    ("what", MAIL): ("confirmed", "Nie działa poczta, internet działa."),
    ("what", BOTH): ("confirmed", "Nie działa internet ani poczta."),
    ("what", UNKNOWN): ("unverified", "Nie ustalono jeszcze, co dokładnie nie działa."),
    ("scope", ALL): ("confirmed", "Problem dotyczy wszystkich komputerów."),
    ("scope", ONE): ("confirmed", "Problem dotyczy jednego komputera."),
    ("scope", UNKNOWN): ("unverified", "Nie wiadomo, ilu komputerów dotyczy problem."),
    ("provider", YES): ("confirmed", "Dostawca potwierdza awarię po swojej stronie."),
    ("provider", NO): ("confirmed", "Dostawca nie widzi awarii."),
    ("provider", UNKNOWN): ("unverified", "Nikt jeszcze nie pytał dostawcy o awarię."),
    ("signs", YES): ("confirmed", "Są objawy, które mogą oznaczać atak."),
    ("signs", NO): ("confirmed", "Brak innych niepokojących objawów."),
    ("signs", UNKNOWN): ("unverified", "Nie sprawdzono, czy są inne objawy ataku."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    scope, provider, signs = answers.get("scope", UNKNOWN), answers.get("provider", UNKNOWN), answers.get("signs", UNKNOWN)
    if provider == YES:
        outside, local = "likely", "unlikely"
    elif scope == ONE:
        outside, local = "unlikely", "likely"
    elif provider == NO:
        outside, local = "unlikely", "likely" if scope == ALL else "possible"
    else:
        outside, local = "possible", "possible"
    attack = "likely" if signs == YES else "unlikely" if signs == NO else "possible"
    return {
        "outside": hypothesis(
            "Awaria u operatora lub dostawcy", outside,
            "Problem jest poza biurem. Trzeba przeczekać i pracować kanałami zastępczymi.",
            why([(provider == YES, "dostawca potwierdza awarię")]), None),
        "local": hypothesis(
            "Problem w biurze", local,
            "Router, kabel, ustawienia komputera albo skończony abonament. Zwykle da się to naprawić na miejscu.",
            why([(scope == ONE, "problem dotyczy jednego komputera"), (provider == NO, "dostawca nie widzi awarii")]), None),
        "attack": hypothesis(
            "Atak, nie awaria", attack,
            "Zmienione hasła albo żądanie okupu oznaczają, że to incydent bezpieczeństwa. Otwórz właściwy poradnik.",
            why([(signs == YES, "są inne niepokojące objawy")]), None),
    }


def net(c: dict) -> bool:
    return answer(c, "what") in (NET, BOTH, UNKNOWN)


def mail(c: dict) -> bool:
    return answer(c, "what") in (MAIL, BOTH, UNKNOWN)


ACTIONS = [
    {"id": "check_scope", "phase": "assess", "title": "Sprawdź, gdzie dokładnie nie działa",
     "detail": "Inny komputer, telefon w Wi-Fi biura i telefon na danych komórkowych. Jeśli działa tylko na danych komórkowych, problem jest w biurze albo u operatora.",
     "role": "office", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "phone_mode", "phase": "continue", "title": "Pilne sprawy telefonicznie",
     "detail": "Klienci i kontrahenci dostają krótką informację o awarii. Gotowy tekst poniżej.",
     "role": "office", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "restart_router", "phase": "stop", "title": "Uruchom ponownie router i sprawdź kable",
     "detail": "Wyłącz router na 30 sekund. Sprawdź, czy kable siedzą w gniazdach, a lampki świecą jak zwykle.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and lvl(c, "local") != "unlikely"},
    {"id": "call_provider", "phase": "assess", "title": "Zadzwoń do operatora internetu",
     "detail": "Numer jest na umowie albo fakturze. Zapytaj o awarię w okolicy i o termin naprawy.",
     "role": "office", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and answer(c, "provider") == UNKNOWN},
    {"id": "mail_status", "phase": "assess", "title": "Sprawdź stronę statusu dostawcy poczty",
     "detail": "Google Workspace Status Dashboard albo stan usług Microsoft 365. Jeśli internet nie działa, sprawdź z telefonu.",
     "role": "it", "priority": "15min", "safe_any_cause": False, "when": lambda c: mail(c) and answer(c, "provider") == UNKNOWN},
    {"id": "hotspot", "phase": "continue", "title": "Uruchom internet awaryjny z telefonu",
     "detail": "Udostępnij internet z telefonu jednemu komputerowi do najważniejszych spraw, na przykład bankowości i terminów.",
     "role": "office", "priority": "15min", "safe_any_cause": False, "when": lambda c: net(c) and lvl(c, "attack") != "likely"},
    {"id": "no_private_mail", "phase": "continue", "title": "Nie wysyłajcie danych klientów z prywatnych skrzynek",
     "detail": "To wygodne, ale wyprowadza dane poza firmę. Lepiej telefon, spotkanie albo przeczekanie awarii.",
     "role": "all", "priority": "15min", "safe_any_cause": False, "when": lambda c: mail(c)},
    {"id": "fix_one", "phase": "stop", "title": "Napraw ustawienia jednego komputera",
     "detail": "Sprawdź Wi-Fi, kabel, datę i godzinę systemu oraz ostatnio instalowane programy. Uruchom komputer ponownie.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "scope") == ONE},
    {"id": "attack_check", "phase": "assess", "title": "Sprawdź, czy to nie atak",
     "detail": "Zmienione hasła, okup albo dziwne komunikaty? Otwórz incydent „Zaszyfrowane pliki” albo „Ktoś zalogował się na nasze konto”.",
     "role": "boss", "priority": "now", "safe_any_cause": False, "when": lambda c: lvl(c, "attack") != "unlikely"},
    {"id": "log_outage", "phase": "learn", "title": "Zapisz przebieg awarii",
     "detail": "Kiedy się zaczęła, co pomogło, ile trwała. Przyda się przy reklamacji u operatora i przy planie na następny raz.",
     "role": "office", "priority": "verify", "safe_any_cause": False, "when": lambda c: True},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Nasza firma"
    what = {NET: "internetu", MAIL: "poczty"}.get(answers.get("what", BOTH), "internetu i poczty")
    boss = boss_name(org)
    return [
        {"id": "sms_clients", "channel": "SMS do klientów",
         "text": f"{name}: mamy awarię {what}. Maile mogą do nas nie docierać. W pilnych sprawach {phone_line(org)} Dziękujemy za cierpliwość."},
        {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
         "text": f"Awaria {what}. Pilne sprawy telefonicznie, nie wysyłamy danych klientów z prywatnych skrzynek. "
                 f"Informacje o naprawie przekażę telefonicznie.{f' Koordynuje {boss}.' if boss else ''}"},
    ]


LESSONS: list[str] = []
UODO_QUESTION = None


def uodo(answers: dict, hyp: dict) -> bool:
    return False


def impact(answers: dict) -> dict:
    what = answers.get("what", BOTH)
    untrusted = {NET: ["siec"], MAIL: ["poczta"]}.get(what, ["siec", "poczta"])
    return {"untrusted": untrusted, "at_risk": ["operations_stopped"],
            "note": "Internet lub poczta: niedostępne. Pracujemy kanałami zastępczymi i nie przenosimy danych klientów na prywatne konta."}
