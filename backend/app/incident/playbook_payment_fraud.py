from collections.abc import Callable
from dataclasses import dataclass

from ..schemas import Fact, Hypothesis, Lesson, Organization, Phase, Priority, Question, QuestionOption

TYPE_ID = "payment_fraud"
TYPE_LABEL = "Fałszywa wiadomość z nowym numerem rachunku"
TYPE_DESCRIPTION = "Klienci dostają maile podpisane adresem biura z prośbą o wpłatę na nowy rachunek."
UNTRUSTED_SERVICE = "email"


@dataclass(frozen=True)
class QuestionDef:
    id: str
    text: str
    short: str
    help: str
    options: tuple[tuple[str, str], ...]
    default: str
    in_form: bool = True


@dataclass(frozen=True)
class PlanContext:
    answers: dict[str, str]
    hypotheses: dict[str, str]

    def answer(self, question_id: str) -> str:
        return self.answers.get(question_id, "")

    def is_open(self, hypothesis_id: str) -> bool:
        return self.hypotheses.get(hypothesis_id) in ("likely", "possible")


@dataclass(frozen=True)
class ActionDef:
    id: str
    title: str
    detail: str
    priority: Priority
    phase: Phase
    role: str
    when: Callable[[PlanContext], bool]
    safe_any_cause: bool = False
    tag: str | None = None
    template: str | None = None


QUESTIONS: tuple[QuestionDef, ...] = (
    QuestionDef(
        "Q1",
        "Czy wszyscy w biurze potwierdzili, że nie wysłali tej wiadomości?",
        "Nikt z biura jej nie wysłał",
        "Zanim uznamy wiadomość za oszustwo, wykluczamy zwykłą pomyłkę.",
        (("yes", "Tak, nikt jej nie wysłał"), ("not_yet", "Jeszcze nie wszyscy")),
        "not_yet",
    ),
    QuestionDef(
        "Q2",
        "Czy ta wiadomość jest w folderze Wysłane skrzynki {mailbox}?",
        "Wiadomość w folderze Wysłane",
        "To najszybszy sposób, żeby odróżnić przejęcie skrzynki od podszycia.",
        (("yes", "Tak, jest"), ("no", "Nie ma jej"), ("unknown", "Nie wiem jeszcze")),
        "unknown",
    ),
    QuestionDef(
        "Q3",
        "Czy któryś klient już zapłacił na podany rachunek?",
        "Wpłata na rachunek oszusta",
        "Jeśli tak, liczy się każda godzina: bank może jeszcze zatrzymać przelew.",
        (("yes", "Tak"), ("no", "Nie"), ("unknown", "Nie wiem")),
        "unknown",
    ),
    QuestionDef(
        "Q4",
        "Czy biuro może dziś pracować bez e-maila?",
        "Praca bez e-maila",
        "Od tego zależy, jak szybko uruchamiamy kanały zastępcze.",
        (("yes", "Tak"), ("partly", "Częściowo"), ("no", "Nie")),
        "partly",
    ),
    QuestionDef(
        "Q5",
        "Co jest najważniejsze w ciągu 24 godzin?",
        "Priorytet na dziś",
        "Od tego zależy kolejność w trybie ciągłości.",
        (
            ("deadlines", "Terminy JPK i deklaracji"),
            ("payments", "Płatności klientów"),
            ("contact", "Kontakt z klientami"),
        ),
        "deadlines",
    ),
    QuestionDef(
        "Q6",
        "Czy potwierdzono, że ktoś niepowołany miał dostęp do dokumentów klientów?",
        "Dostęp do dokumentów klientów",
        "Od odpowiedzi zależą obowiązki z RODO.",
        (("yes", "Tak"), ("no", "Nie, sprawdziliśmy"), ("unknown", "Nie wiadomo")),
        "unknown",
        in_form=False,
    ),
)

QUESTION_INDEX = {q.id: q for q in QUESTIONS}
PRIORITY_ACTIVITY = {"deadlines": "jpk", "payments": "payments_info", "contact": "contact"}


def questions(org: Organization) -> list[Question]:
    return [
        Question(
            id=q.id,
            text=q.text.format(mailbox=org.mailbox),
            short=q.short,
            help=q.help,
            options=[QuestionOption(value=value, label=label) for value, label in q.options],
            in_form=q.in_form,
        )
        for q in QUESTIONS
    ]


def defaults() -> dict[str, str]:
    return {q.id: q.default for q in QUESTIONS}


def validate_answers(answers: dict[str, str]) -> None:
    for question_id, value in answers.items():
        question = QUESTION_INDEX.get(question_id)
        if question is None:
            raise ValueError(f"Nieznane pytanie: {question_id}.")
        if value not in {option for option, _ in question.options}:
            raise ValueError(f"Niepoprawna odpowiedź na pytanie {question_id}.")


def answer_label(question_id: str, value: str) -> str:
    question = QUESTION_INDEX[question_id]
    return next(label for option, label in question.options if option == value)


def hypotheses(answers: dict[str, str], org: Organization) -> list[Hypothesis]:
    sent = answers.get("Q2", "unknown")
    dmarc = next((s for s in org.safeguards if s.id == "domain_dmarc"), None)
    kret_warned = (
        f"Kret ostrzegał: domena {org.domain} nie ma DMARC, więc podszycie jest łatwe."
        if dmarc is not None and dmarc.state == "missing"
        else None
    )
    takeover = {
        "yes": ("likely", "Wiadomość jest w Wysłanych, więc wyszła z naszej skrzynki."),
        "unknown": ("possible", "Nikt jeszcze nie sprawdził folderu Wysłane."),
        "no": (
            "unlikely",
            "Wiadomości nie ma w Wysłanych. Włamywacz mógł ją jednak usunąć, dlatego zostaje sprawdzenie logowań.",
        ),
    }[sent]
    spoofing = {
        "yes": ("unlikely", "Wiadomość wyszła z naszej skrzynki, więc nikt nie musiał się podszywać."),
        "unknown": ("possible", "Adres nadawcy jest nasz, ale nie wiemy jeszcze, skąd naprawdę przyszła wiadomość."),
        "no": ("likely", "Wiadomości nie ma w Wysłanych, a nadawca podpisuje się naszym adresem."),
    }[sent]
    return [
        Hypothesis(id="H1", label=f"Ktoś przejął skrzynkę {org.mailbox}", likelihood=takeover[0], reason=takeover[1]),
        Hypothesis(
            id="H2",
            label="Ktoś podszywa się pod adres biura",
            likelihood=spoofing[0],
            reason=spoofing[1],
            kret_warned=kret_warned if spoofing[0] != "unlikely" else None,
        ),
    ]


ACTIONS: tuple[ActionDef, ...] = (
    ActionDef(
        "A1",
        "Uznaj skrzynkę {mailbox} za niezaufaną",
        "Do odwołania nie wysyłamy z niej kwot ani numerów rachunków. Odpowiedzi klientów sprawdzamy telefonicznie.",
        "now",
        "stop",
        "Właścicielka",
        lambda c: True,
        safe_any_cause=True,
    ),
    ActionDef(
        "A2",
        "Zadzwoń do klientów z dzisiejszym terminem",
        "Rachunek się nie zmienił, podatek płacą na swój mikrorachunek. Skorzystaj z wydrukowanej listy telefonów.",
        "now",
        "notify",
        "Księgowa VAT i KSeF, Sekretariat",
        lambda c: True,
        safe_any_cause=True,
        template="phone_script",
    ),
    ActionDef(
        "A6",
        "Zapytaj wszystkich w biurze, czy ktoś wysłał tę wiadomość",
        "Zajmie to 5 minut i wyklucza zwykłą pomyłkę.",
        "now",
        "assess",
        "Właścicielka",
        lambda c: c.answer("Q1") != "yes",
        safe_any_cause=True,
    ),
    ActionDef(
        "A7",
        "Klient, który zapłacił, dzwoni teraz do swojego banku",
        "Prosi o zatrzymanie przelewu, potem zgłasza sprawę na policję. Liczy się czas.",
        "now",
        "notify",
        "Właścicielka",
        lambda c: c.answer("Q3") == "yes",
        safe_any_cause=True,
    ),
    ActionDef(
        "A18",
        "Ustal dyżur telefoniczny",
        "Ktoś odbiera telefon biura do 18:00, a klienci dostają ten numer w komunikacie.",
        "now",
        "continue",
        "Sekretariat",
        lambda c: c.answer("Q4") in ("no", "partly"),
        safe_any_cause=True,
    ),
    ActionDef(
        "A9",
        "Wyloguj wszystkie sesje skrzynki {mailbox}",
        "To nic nie psuje, a odcina kogoś, kto może być zalogowany.",
        "now",
        "stop",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H1"),
        safe_any_cause=True,
        tag="przy przejęciu",
    ),
    ActionDef(
        "A16",
        "Powiadom klientów, których dokumenty mogły wyciec",
        "Dane ich pracowników biuro przetwarza w ich imieniu. Musi ich zawiadomić bez zbędnej zwłoki, "
        "a do UODO w ciągu 72 h zgłaszają oni.",
        "now",
        "notify",
        "Właścicielka",
        lambda c: c.answer("Q6") == "yes",
        tag="RODO",
    ),
    ActionDef(
        "A17",
        "Zgłoś naruszenie do UODO w ciągu 72 h",
        "Dotyczy danych, których biuro jest administratorem, np. danych kontaktowych klientów. "
        "Termin liczy się od stwierdzenia naruszenia.",
        "now",
        "notify",
        "Właścicielka",
        lambda c: c.answer("Q6") == "yes",
        tag="RODO",
    ),
    ActionDef(
        "A3",
        "Opublikuj komunikat na stronie statusowej",
        "Jeden tekst dla wszystkich klientów: nie zmieniamy rachunków mailem.",
        "15min",
        "notify",
        "Właścicielka",
        lambda c: True,
        safe_any_cause=True,
        template="status_page",
    ),
    ActionDef(
        "A8",
        "Przy każdym telefonie zapytaj, czy klient już zapłacił",
        "Jeśli tak, od razu przechodzimy do kontaktu z bankiem.",
        "15min",
        "assess",
        "Sekretariat",
        lambda c: c.answer("Q3") == "unknown",
        safe_any_cause=True,
    ),
    ActionDef(
        "A10",
        "Zmień hasło z innego, czystego urządzenia i włącz MFA",
        "Nowe hasło znają tylko osoby, które naprawdę muszą.",
        "15min",
        "stop",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H1"),
        tag="przy przejęciu",
    ),
    ActionDef(
        "A11",
        "Sprawdź reguły przekierowania i filtry",
        "Oszuści ukrywają nimi odpowiedzi klientów albo kopiują pocztę na zewnątrz.",
        "15min",
        "stop",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H1"),
        tag="przy przejęciu",
    ),
    ActionDef(
        "A14",
        "Sprawdź nagłówki wiadomości od klienta",
        "Z jakiego serwera naprawdę przyszła i dokąd idą odpowiedzi.",
        "15min",
        "assess",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H2"),
        tag="przy podszyciu",
    ),
    ActionDef(
        "A4",
        "Zapisz, którzy klienci dostali wiadomość",
        "Lista przyda się do kolejnych telefonów i do zgłoszenia.",
        "30min",
        "assess",
        "Sekretariat",
        lambda c: True,
        safe_any_cause=True,
    ),
    ActionDef(
        "A5",
        "Zgłoś incydent do CERT Polska",
        "Formularz na incydent.cert.pl. Podaj treść wiadomości i rachunek oszusta.",
        "30min",
        "notify",
        "Właścicielka",
        lambda c: True,
        safe_any_cause=True,
    ),
    ActionDef(
        "A12",
        "Sprawdź aplikacje i urządzenia z dostępem do konta",
        "Usuń wszystko, czego nikt w biurze nie rozpoznaje.",
        "30min",
        "stop",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H1"),
        tag="przy przejęciu",
    ),
    ActionDef(
        "A15",
        "Dodaj rekord DMARC dla {domain}",
        "Jeśli SPF obejmuje wszystkie serwery wysyłające pocztę biura, od razu z polityką quarantine.",
        "30min",
        "stop",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H2"),
        tag="przy podszyciu",
    ),
    ActionDef(
        "A13",
        "Sprawdź dziennik aktywności dysku",
        "Czy ktoś pobierał dokumenty klientów? Wynik wpisz w pytanie o dostęp do dokumentów.",
        "verify",
        "assess",
        "Informatyk zewnętrzny",
        lambda c: c.is_open("H1"),
        tag="przy przejęciu",
    ),
    ActionDef(
        "A13b",
        "Przejrzyj dziennik logowań do {mailbox} z ostatnich 30 dni",
        "Wiadomości nie ma w Wysłanych, ale włamywacz mógł ją usunąć.",
        "verify",
        "assess",
        "Informatyk zewnętrzny",
        lambda c: c.hypotheses.get("H1") == "unlikely",
        tag="zapobiegawczo",
    ),
)

ACTION_INDEX = {a.id: a for a in ACTIONS}


def facts(answers: dict[str, str], reported: list[str], org: Organization) -> list[Fact]:
    result = [
        Fact(
            id="report",
            text=f"Klient dostał maila podpisanego {org.mailbox} z nowym numerem rachunku.",
            state="confirmed",
            source="zgłoszenie",
        )
    ]
    for index, text in enumerate(reported):
        result.append(Fact(id=f"analysis_{index}", text=text, state="confirmed", source="analiza wiadomości"))

    by_answer = {
        "Q1": {
            "yes": ("confirmed", "Nikt z biura nie wysłał tej wiadomości."),
            "not_yet": ("unverified", "Nie wszyscy w biurze potwierdzili, że nie wysłali tej wiadomości."),
        },
        "Q2": {
            "yes": ("confirmed", f"Wiadomość jest w folderze Wysłane skrzynki {org.mailbox}."),
            "no": ("confirmed", f"Wiadomości nie ma w folderze Wysłane skrzynki {org.mailbox}."),
            "unknown": ("unverified", "Nie wiadomo, czy wiadomość wyszła z naszej skrzynki."),
        },
        "Q3": {
            "yes": ("confirmed", "Co najmniej jeden klient zapłacił na rachunek oszusta."),
            "no": ("confirmed", "Klienci, z którymi rozmawialiśmy, nie zapłacili."),
            "unknown": ("unverified", "Nie wiadomo, czy ktoś już zapłacił."),
        },
        "Q4": {
            "yes": ("confirmed", "Biuro może dziś pracować bez e-maila."),
            "partly": ("confirmed", "Bez e-maila biuro może dziś pracować tylko częściowo."),
            "no": ("confirmed", "Bez e-maila biuro nie może dziś normalnie pracować."),
        },
        "Q6": {
            "yes": ("confirmed", "Ktoś niepowołany miał dostęp do dokumentów klientów."),
            "no": ("confirmed", "Nie ma śladów dostępu do dokumentów klientów."),
            "unknown": ("unverified", "Nie wiadomo, czy ktoś niepowołany widział dokumenty klientów."),
        },
    }
    for question_id, options in by_answer.items():
        state, text = options[answers[question_id]]
        result.append(Fact(id=question_id, text=text, state=state, source="odpowiedź", question=question_id))

    dmarc = next((s for s in org.safeguards if s.id == "domain_dmarc"), None)
    if dmarc is not None and dmarc.state == "missing" and dmarc.source == "kret":
        result.append(
            Fact(id="kret_dmarc", text=f"Domena {org.domain} nie ma DMARC.", state="confirmed", source="kret")
        )
    return result


def lessons(hypotheses_by_id: dict[str, str], org: Organization) -> list[Lesson]:
    reasons = {
        "payments_fixed_accounts": "Klient, który zna tę zasadę, nie zapłaci na nowy rachunek z maila.",
        "domain_dmarc": "Bez DMARC każdy może znowu podpisać się adresem biura.",
        "email_mfa": "Następnym razem oszust może nie podszywać się, tylko przejąć skrzynkę.",
        "email_unique_password": "Wspólne hasło utrudnia ustalenie, kto i skąd się logował.",
    }
    wanted = ["payments_fixed_accounts"]
    if hypotheses_by_id.get("H2") != "unlikely":
        wanted.append("domain_dmarc")
    wanted.append("email_mfa")
    if hypotheses_by_id.get("H1") != "unlikely":
        wanted.append("email_unique_password")
    safeguards = {s.id: s for s in org.safeguards}
    return [
        Lesson(
            safeguard=sid,
            fix=safeguards[sid].fix,
            why=safeguards[sid].why,
            reason=reasons[sid],
            state=safeguards[sid].state,
        )
        for sid in wanted
        if sid in safeguards
    ]
