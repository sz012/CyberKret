"""Someone logged into a company mail or cloud account."""
from .common import NO, UNKNOWN, YES, YES_NO, answer, boss_name, hypothesis, lvl, phone_line, safeguard_missing, why

ID = "account_takeover"
LABEL = "Ktoś zalogował się na nasze konto"

QUESTIONS = [
    {"id": "access", "text": "Czy nadal możesz zalogować się na to konto?",
     "options": [(YES, "Tak"), (NO, "Nie, ktoś zmienił hasło"), (UNKNOWN, "Nie wiem jeszcze")]},
    {"id": "sent", "text": "Czy z konta wyszły maile, których nikt z nas nie pisał?", "options": YES_NO},
    {"id": "reused", "text": "Czy to samo hasło było używane na innych kontach?", "options": YES_NO},
    {"id": "clicked", "text": "Czy ktoś wpisał hasło na stronie z linku w mailu lub SMS-ie?", "options": YES_NO},
    {"id": "data", "text": "Czy na tym koncie były dane klientów (maile, pliki)?", "options": YES_NO},
]

FACTS = {
    ("access", YES): ("confirmed", "Nadal mamy dostęp do konta."),
    ("access", NO): ("confirmed", "Ktoś zmienił hasło i nie mamy dostępu do konta."),
    ("access", UNKNOWN): ("unverified", "Nikt nie sprawdził, czy da się zalogować."),
    ("sent", YES): ("confirmed", "Z konta wyszły maile, których nikt nie pisał."),
    ("sent", NO): ("confirmed", "Z konta nie wyszły obce maile."),
    ("sent", UNKNOWN): ("unverified", "Nikt jeszcze nie sprawdził folderu Wysłane."),
    ("reused", YES): ("confirmed", "To samo hasło było na innych kontach."),
    ("reused", NO): ("confirmed", "Hasło było używane tylko na tym koncie."),
    ("reused", UNKNOWN): ("unverified", "Nie wiadomo, czy hasło powtarzało się gdzie indziej."),
    ("clicked", YES): ("confirmed", "Ktoś wpisał hasło na stronie z podejrzanego linku."),
    ("clicked", NO): ("confirmed", "Nikt nie wpisywał hasła na stronach z linków."),
    ("clicked", UNKNOWN): ("unverified", "Nie wiadomo, czy ktoś wpisał hasło na fałszywej stronie."),
    ("data", YES): ("confirmed", "Na koncie były dane klientów."),
    ("data", NO): ("confirmed", "Na koncie nie było danych klientów."),
    ("data", UNKNOWN): ("unverified", "Nie wiadomo, czy na koncie były dane klientów."),
}


def hypotheses(answers: dict, facts: list[dict], org: dict) -> dict:
    reused, clicked = answers.get("reused", UNKNOWN), answers.get("clicked", UNKNOWN)
    phishing = "likely" if clicked == YES else "unlikely" if clicked == NO and reused == YES else "possible"
    leak = "likely" if reused == YES and clicked != YES else "unlikely" if reused == NO else "possible"
    mfa = "Kret ostrzegał: konta pocztowe logują się samym hasłem." if safeguard_missing(org, "m365_mfa") else None
    return {
        "phishing": hypothesis(
            "Hasło wyłudzone fałszywą stroną", phishing,
            "Ktoś wpisał hasło na podrobionej stronie logowania i przestępca od razu go użył.",
            why([(clicked == YES, "ktoś wpisał hasło na stronie z linku")]), mfa),
        "leak": hypothesis(
            "Hasło z wycieku innego serwisu", leak,
            "To samo hasło wyciekło z innej strony, a przestępcy sprawdzają je automatycznie na pocztach.",
            why([(reused == YES, "to samo hasło było na innych kontach")]), mfa),
    }


ACTIONS = [
    {"id": "reset_password", "phase": "stop", "title": "Zmień hasło z innego, czystego urządzenia",
     "detail": "Długie, nowe hasło, którego nie używasz nigdzie indziej. Najlepiej z menedżera haseł.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: answer(c, "access") != NO},
    {"id": "recover", "phase": "stop", "title": "Odzyskaj konto przez formularz dostawcy",
     "detail": "Google i Microsoft mają formularz odzyskiwania konta. Przygotuj stary numer telefonu i adres zapasowy.",
     "role": "it", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "access") == NO},
    {"id": "signout", "phase": "stop", "title": "Wyloguj konto ze wszystkich urządzeń",
     "detail": "W ustawieniach bezpieczeństwa konta zakończ wszystkie sesje. Przestępca straci dostęp nawet z zapamiętanym logowaniem.",
     "role": "it", "priority": "now", "safe_any_cause": True, "when": lambda c: True},
    {"id": "enable_mfa", "phase": "stop", "title": "Włącz logowanie dwuetapowe (MFA)",
     "detail": "Kod z aplikacji w telefonie zatrzyma kolejną próbę, nawet jeśli hasło znowu wycieknie.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "check_recovery", "phase": "assess", "title": "Sprawdź telefon i adres do odzyskiwania konta",
     "detail": "Przestępcy podmieniają je, żeby wrócić. Usuń obce numery i adresy.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "inbox_rules", "phase": "assess", "title": "Sprawdź reguły przekierowania i filtry",
     "detail": "Usuń reguły, które przesyłają maile na obce adresy albo chowają odpowiedzi.",
     "role": "it", "priority": "15min", "safe_any_cause": True, "when": lambda c: True},
    {"id": "apps", "phase": "assess", "title": "Odbierz dostęp nieznanym aplikacjom",
     "detail": "W ustawieniach konta zobacz połączone aplikacje i usuń te, których nie znasz.",
     "role": "it", "priority": "1h", "safe_any_cause": False, "when": lambda c: True},
    {"id": "other_accounts", "phase": "stop", "title": "Zmień to samo hasło na innych kontach",
     "detail": "Wszędzie, gdzie było to samo hasło, przestępca wejdzie tak samo.",
     "role": "all", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "reused") != NO},
    {"id": "check_payments", "phase": "assess", "title": "Sprawdź, czy z konta nie poszły prośby o przelew",
     "detail": "Przejęte konto to idealne miejsce na fałszywą fakturę. Przejrzyj Wysłane i zadzwoń do kontrahentów, którzy dostali maile.",
     "role": "finance", "priority": "now", "safe_any_cause": False, "when": lambda c: answer(c, "sent") == YES},
    {"id": "warn_contacts", "phase": "notify", "title": "Ostrzeż osoby, które dostały maile z konta",
     "detail": "Telefonem albo z innego konta. Gotowy tekst poniżej.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "sent") != NO},
    {"id": "report_cert", "phase": "notify", "title": "Zgłoś fałszywą stronę logowania do CERT Polska",
     "detail": "incydent.cert.pl. CERT ostrzeże innych i może zablokować podrobioną stronę.",
     "role": "office", "priority": "1h", "safe_any_cause": False, "when": lambda c: lvl(c, "phishing") != "unlikely"},
    {"id": "assess_data", "phase": "assess", "title": "Ustal, co przestępca mógł zobaczyć",
     "detail": "Historia logowań pokaże, kiedy i skąd wchodził. Sprawdź, czy na koncie były dane klientów.",
     "role": "boss", "priority": "verify", "safe_any_cause": False, "when": lambda c: answer(c, "data") == UNKNOWN},
    {"id": "uodo", "phase": "notify", "title": "Zgłoś naruszenie do UODO w ciągu 72 godzin",
     "detail": "Obca osoba miała dostęp do maili lub plików z danymi klientów. Zgłoszenie przez biznes.gov.pl.",
     "role": "boss", "priority": "1h", "safe_any_cause": False, "when": lambda c: answer(c, "data") == YES},
]


def messages(org: dict, facts: list[dict], answers: dict) -> list[dict]:
    name = org.get("name") or "Nasza firma"
    boss = boss_name(org)
    return [
        {"id": "contacts", "channel": "Wiadomość do kontaktów",
         "text": f"{name}: ktoś przejął jedno z naszych kont pocztowych i mógł wysyłać wiadomości w naszym imieniu. Nie otwieraj linków ani "
                 f"załączników z tych maili i nie płać na podane w nich numery kont. W razie wątpliwości {phone_line(org)}"},
        {"id": "team", "channel": "Wiadomość do zespołu (SMS)",
         "text": "Przejęte konto pocztowe. Do odwołania nie ufamy mailom z tego konta, ważne sprawy załatwiamy telefonicznie. "
                 f"Nie wpisujcie haseł na stronach z linków.{f' Koordynuje {boss}.' if boss else ''}"},
    ]


LESSONS = ["m365_mfa", "payment_callback_rule"]
UODO_QUESTION = "data"


def uodo(answers: dict, hyp: dict) -> bool:
    return answers.get("data") == YES


def impact(answers: dict) -> dict:
    return {"untrusted": ["konta", "poczta"], "at_risk": ["client_data_read", "money_stolen"],
            "note": "Przejęte konto: niezaufane, dopóki hasło nie jest zmienione, sesje wylogowane, a reguły skrzynki sprawdzone."}
