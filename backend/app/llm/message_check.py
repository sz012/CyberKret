import re
from dataclasses import dataclass
from typing import Any, Protocol

from ..schemas import Indicator, MessageCheckResult, Organization, Verdict

LABELS = {
    "account_change": "Prośba o zmianę rachunku",
    "account_number": "Numer rachunku w treści",
    "urgency": "Presja czasu",
    "no_verification": "Zniechęcanie do sprawdzenia",
    "reply_to_mismatch": "Odpowiedzi idą na inny adres",
    "lookalike_domain": "Domena podobna do Waszej",
    "pretext": "Aktualny pretekst",
    "other": "Inny sygnał",
}
STRONG = {"account_change", "reply_to_mismatch", "lookalike_domain"}
MAX_MODEL_INDICATORS = 12

SUMMARIES: dict[Verdict, str] = {
    "suspicious": "Ta wiadomość ma kilka cech typowego oszustwa na zmianę rachunku.",
    "unclear": "Wiadomość ma pojedyncze sygnały ostrzegawcze albo nie da się jej ocenić bez sprawdzenia.",
    "likely_safe": "Nie widzę typowych sygnałów oszustwa. To nie znaczy, że wiadomość jest bezpieczna.",
}
ADVICE: dict[Verdict, str] = {
    "suspicious": "Nie płaćcie. Zadzwońcie do nadawcy na numer, który już znacie, nie na numer z tej wiadomości.",
    "unclear": "Zanim ktoś zapłaci albo kliknie, sprawdźcie wiadomość telefonicznie pod znanym numerem.",
    "likely_safe": "Jeśli wiadomość prosi o pieniądze albo dane, i tak potwierdźcie ją telefonicznie.",
}

HEADER_FROM = re.compile(r"^[ \t]*(?:od|from)[ \t]*:[ \t]*(.+)$", re.IGNORECASE | re.MULTILINE)
HEADER_REPLY = re.compile(
    r"^[ \t]*(?:odpowiedz do|odpowiedź do|reply-to)[ \t]*:[ \t]*(.+)$", re.IGNORECASE | re.MULTILINE
)
EMAIL = re.compile(r"[\w.+-]+@((?:[\w-]+\.)+[a-z]{2,})", re.IGNORECASE)
URL_HOST = re.compile(r"https?://(?:www\.)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.IGNORECASE)


@dataclass(frozen=True)
class Rule:
    type: str
    pattern: re.Pattern[str]
    explanation: str


RULES: tuple[Rule, ...] = (
    Rule(
        "account_change",
        re.compile(
            r"zmieni\w*\s+się\s+(?:numer\s+)?(?:rachun\w*|kont\w*)"
            r"|zmian\w*\s+(?:numeru\s+)?(?:rachun\w*|kont\w*)"
            r"|now\w+\s+(?:numer\w*\s+)?(?:rachun\w*|kont\w*)",
            re.IGNORECASE,
        ),
        "Prośba o wpłatę na nowy rachunek to najczęstszy sposób wyłudzenia przelewu.",
    ),
    Rule(
        "account_number",
        re.compile(r"(?<!\d)(?:PL\s?)?\d{2}(?:\s?\d{4}){6}(?!\d)", re.IGNORECASE),
        "Numer rachunku w treści maila łatwo podmienić. Sprawdźcie go telefonicznie pod znanym numerem.",
    ),
    Rule(
        "urgency",
        re.compile(
            r"\b(?:pilne|pilnie|natychmiast\w*|niezwłocznie|do końca dnia|jeszcze dziś|w ciągu godziny)\b",
            re.IGNORECASE,
        ),
        "Presja czasu ma sprawić, że nikt nie zdąży niczego sprawdzić.",
    ),
    Rule(
        "no_verification",
        re.compile(
            r"(?:prosimy\s+)?nie\s+dzwo\w*|nie\s+kontaktuj\w*|biuro\s+jest\s+(?:dziś\s+)?zamknięte"
            r"|jesteśmy\s+(?:dziś\s+)?niedostępn\w*",
            re.IGNORECASE,
        ),
        "Zniechęcanie do telefonu to typowy sygnał: oszust nie chce, żebyście sprawdzili wiadomość.",
    ),
    Rule(
        "pretext",
        re.compile(r"\b(?:KSeF|zmian\w*\s+przepisów|nowe\s+przepisy|kontrol\w*\s+skarbow\w*)\b", re.IGNORECASE),
        "Aktualny temat ma uwiarygodnić prośbę. Zmiana przepisów nie zmienia Waszego mikrorachunku podatkowego.",
    ),
)

SYSTEM_PROMPT = """Jesteś asystentem bezpieczeństwa w małym biurze rachunkowym {name} (domena {domain}).
Oceniasz, czy wiadomość może być oszustwem, zwłaszcza próbą wyłudzenia przelewu przez podanie nowego numeru rachunku.
Zasady:
- Cytuj tylko fragmenty, które dosłownie występują w wiadomości.
- Nie zgaduj faktów spoza wiadomości.
- Pisz krótko, po polsku, prostym językiem, bez żargonu.
- Typ wskaźnika wybierz z listy. Jeśli żaden nie pasuje, użyj "other"."""

USER_PROMPT = "Oceń tę wiadomość.\n\n<<<\n{text}\n>>>"

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["suspicious", "likely_safe", "unclear"]},
        "summary": {"type": "string"},
        "indicators": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": list(LABELS)},
                    "quote": {"type": "string"},
                    "explanation": {"type": "string"},
                },
                "required": ["type", "quote", "explanation"],
            },
        },
    },
    "required": ["verdict", "summary", "indicators"],
}


class JsonModel(Protocol):
    model: str

    def chat_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any] | None: ...


@dataclass
class Headers:
    from_line: str | None
    from_domain: str | None
    reply_line: re.Match[str] | None
    reply_domain: str | None


def _levenshtein(a: str, b: str) -> int:
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, 1):
        current = [i]
        for j, char_b in enumerate(b, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (char_a != char_b)))
        previous = current
    return previous[-1]


def _headers(text: str) -> Headers:
    from_match = HEADER_FROM.search(text)
    reply_match = HEADER_REPLY.search(text)
    from_email = EMAIL.search(from_match.group(1)) if from_match else None
    reply_email = EMAIL.search(reply_match.group(1)) if reply_match else None
    return Headers(
        from_line=from_email.group(0) if from_email else None,
        from_domain=from_email.group(1).lower() if from_email else None,
        reply_line=reply_match,
        reply_domain=reply_email.group(1).lower() if reply_email else None,
    )


def _make(kind: str, quote: str, explanation: str, start: int, source: str = "rules") -> Indicator:
    return Indicator(
        type=kind,
        label=LABELS[kind],
        quote=quote,
        explanation=explanation,
        source=source,
        start=start,
        end=start + len(quote),
    )


def _rule_indicators(text: str, org: Organization, headers: Headers) -> tuple[list[Indicator], list[str]]:
    indicators = []
    for rule in RULES:
        match = rule.pattern.search(text)
        if match:
            indicators.append(_make(rule.type, match.group(0), rule.explanation, match.start()))

    lookalikes: list[str] = []
    if (
        headers.reply_line
        and headers.from_domain
        and headers.reply_domain
        and headers.reply_domain != headers.from_domain
    ):
        value = headers.reply_line.group(1).strip()
        indicators.append(
            _make(
                "reply_to_mismatch",
                value,
                f"Wiadomość jest podpisana adresem z domeny {headers.from_domain}, "
                f"ale odpowiedzi trafią do {headers.reply_domain}.",
                headers.reply_line.start(1),
            )
        )

    org_label = org.domain.split(".")[0]
    for match in [*EMAIL.finditer(text), *URL_HOST.finditer(text)]:
        domain = match.group(1).lower()
        label = domain.split(".")[0]
        if domain == org.domain or domain in lookalikes:
            continue
        if (org_label in label and label != org_label) or (len(label) >= 4 and 0 < _levenshtein(label, org_label) <= 2):
            lookalikes.append(domain)
            indicators.append(
                _make(
                    "lookalike_domain",
                    match.group(1),
                    f"Domena {domain} wygląda podobnie do {org.domain}, ale nie należy do biura.",
                    match.start(1),
                )
            )
    return indicators, lookalikes


def _locate(text: str, quote: str) -> int | None:
    index = text.lower().find(quote.lower())
    if index >= 0:
        return index
    words = quote.split()
    if not words:
        return None
    match = re.search(r"\s+".join(re.escape(word) for word in words), text, re.IGNORECASE)
    return match.start() if match else None


def _model_indicators(text: str, data: dict[str, Any], existing: list[Indicator]) -> list[Indicator]:
    result = []
    raw_items = data.get("indicators")
    if not isinstance(raw_items, list):
        return result
    for item in raw_items[:MAX_MODEL_INDICATORS]:
        if not isinstance(item, dict):
            continue
        kind, quote, explanation = item.get("type"), item.get("quote"), item.get("explanation")
        if kind not in LABELS or not isinstance(quote, str) or not isinstance(explanation, str):
            continue
        quote = quote.strip()[:300]
        if len(quote) < 3:
            continue
        start = _locate(text, quote)
        if start is None:
            continue
        end = start + len(quote)
        overlaps = any(i.type == kind and i.start < end and start < i.end for i in [*existing, *result])
        if overlaps:
            continue
        indicator = _make(kind, text[start:end], explanation.strip()[:300], start, source="model")
        result.append(indicator)
    return result


def _verdict(indicators: list[Indicator]) -> Verdict:
    kinds = {i.type for i in indicators}
    strong = kinds & STRONG
    medium = kinds - STRONG - {"other"}
    if (strong and (medium or len(strong) > 1)) or len(medium) >= 3:
        return "suspicious"
    return "unclear"


def _facts(indicators: list[Indicator], headers: Headers, lookalikes: list[str], org: Organization) -> list[str]:
    kinds = {i.type for i in indicators}
    facts = []
    if headers.from_domain == org.domain and headers.from_line:
        facts.append(f"Nadawca podpisuje się adresem {headers.from_line}.")
    if kinds & {"account_change", "account_number"}:
        facts.append("Wiadomość podaje nowy numer rachunku do wpłaty.")
    if "reply_to_mismatch" in kinds and headers.reply_domain:
        facts.append(
            f"Odpowiedzi na wiadomość trafiają do domeny {headers.reply_domain}, nie do {headers.from_domain}."
        )
    if "urgency" in kinds:
        facts.append("Wiadomość wywiera presję czasu.")
    if "no_verification" in kinds:
        facts.append("Wiadomość zniechęca do sprawdzenia jej telefonicznie.")
    for domain in lookalikes:
        facts.append(f"Wiadomość używa domeny podobnej do {org.domain}: {domain}.")
    return facts


def analyze_message(text: str, org: Organization, model: JsonModel | None) -> MessageCheckResult:
    headers = _headers(text)
    indicators, lookalikes = _rule_indicators(text, org, headers)
    rules_verdict = _verdict(indicators) if indicators else "unclear"

    data = None
    note = None
    if model is not None:
        data = model.chat_json(
            SYSTEM_PROMPT.format(name=org.name, domain=org.domain),
            USER_PROMPT.format(text=text),
            RESPONSE_SCHEMA,
        )
        if data is None:
            note = "Model lokalny nie odpowiedział. Wynik pochodzi z reguł."
    else:
        note = "Model lokalny jest wyłączony. Wynik pochodzi z reguł."

    verdict: Verdict = rules_verdict
    summary = SUMMARIES[verdict]
    if data is not None:
        indicators = [*indicators, *_model_indicators(text, data, indicators)]
        model_verdict = data.get("verdict")
        if rules_verdict != "suspicious":
            if model_verdict == "suspicious" or _verdict(indicators) == "suspicious":
                verdict = "suspicious"
            elif model_verdict == "likely_safe" and not indicators:
                verdict = "likely_safe"
        model_summary = data.get("summary")
        if model_verdict == verdict and isinstance(model_summary, str) and model_summary.strip():
            summary = model_summary.strip()[:400]
        else:
            summary = SUMMARIES[verdict]

    indicators.sort(key=lambda i: i.start)
    return MessageCheckResult(
        verdict=verdict,
        summary=summary,
        advice=ADVICE[verdict],
        indicators=indicators,
        facts=_facts(indicators, headers, lookalikes, org),
        mode="model" if data is not None else "rules",
        model=model.model if data is not None and model is not None else None,
        note=note,
    )
