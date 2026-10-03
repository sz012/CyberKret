"""Kret pocztowy: deterministic checks of a message first, the local model only explains them.

Attachments are read as bytes and text. Nothing is executed or rendered.
"""
import re
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, parseaddr
from html.parser import HTMLParser

from ..llm import ollama

URGENCY = [r"\bpiln\w*", r"natychmiast", r"do końca dnia", r"w ciągu 24", r"dzisiaj", r"zablokowan\w*", r"wstrzyma\w*", r"ostatni\w* termin"]
ACCOUNT_CHANGE = [r"(now\w*|zmian\w*|aktualizacj\w*)\s+(numer\w*\s+)?(rachunk\w*|kont\w* bankow\w*)", r"numer\w* rachunk\w*"]
IBAN = re.compile(r"\b(?:PL\s?)?\d{2}(?:\s?\d{4}){6}\b")
RISKY_EXT = {"exe", "scr", "js", "vbs", "bat", "cmd", "iso", "img", "lnk", "hta", "html", "htm", "docm", "xlsm", "zip", "rar", "7z"}
DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "jpg", "png", "txt"}

VERDICT = {
    "danger": {"label": "Nie otwieraj, zgłoś", "level": "bad"},
    "caution": {"label": "Sprawdź, zanim klikniesz", "level": "warn"},
    "safe": {"label": "Wygląda bezpiecznie", "level": "ok"},
}


class _Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []
        self.forms = 0
        self.passwords = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "a":
            self._href, self._text = a.get("href") or "", []
        elif tag == "form":
            self.forms += 1
        elif tag == "input" and (a.get("type") or "").lower() == "password":
            self.passwords += 1

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, "".join(self._text).strip()))
            self._href = None


def _domain_of(addr_or_url: str) -> str:
    s = addr_or_url.strip().lower()
    if "@" in s and "://" not in s:
        return s.rsplit("@", 1)[1].strip(">")
    m = re.match(r"^[a-z]+://([^/:?#]+)", s)
    return m.group(1).removeprefix("www.") if m else ""


def _base(domain: str) -> str:
    parts = domain.split(".")
    return parts[-2] if len(parts) >= 2 else domain


def _lev(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def lookalike(domain: str, known: list[dict]) -> dict | None:
    """A domain that imitates a known contact without being it (biurex-pl.example vs biurex.example)."""
    if not domain:
        return None
    for c in known:
        kd = c["domain"]
        if domain == kd or domain.endswith("." + kd):
            return None
    for c in known:
        kb, db = _base(c["domain"]), _base(domain)
        if len(kb) >= 4 and (kb in db or _lev(kb, db) <= 2):
            return c
    return None


def _auth_results(msg: EmailMessage) -> dict:
    raw = " ".join(str(h) for h in msg.get_all("Authentication-Results", []))
    out = {}
    for k in ("spf", "dkim", "dmarc"):
        m = re.search(rf"\b{k}=(\w+)", raw, re.I)
        out[k] = m.group(1).lower() if m else None
    return out


def parse(eml: bytes | str) -> EmailMessage:
    data = eml.encode() if isinstance(eml, str) else eml
    return BytesParser(policy=policy.default).parsebytes(data)


def summarize(msg: EmailMessage) -> dict:
    """Headers and bodies for the inbox view."""
    plain = msg.get_body(preferencelist=("plain",))
    html = msg.get_body(preferencelist=("html",))
    text = plain.get_content() if plain else ""
    if not text and html:
        text = re.sub(r"<[^>]+>", " ", html.get_content())
    name, addr = parseaddr(str(msg.get("From", "")))
    atts = []
    for part in msg.iter_attachments():
        payload = part.get_payload(decode=True) or b""
        atts.append({"filename": part.get_filename() or "bez_nazwy", "content_type": part.get_content_type(), "size": len(payload)})
    return {
        "from_name": name or addr, "from_addr": addr, "to": [a for _, a in getaddresses(msg.get_all("To", []))],
        "reply_to": parseaddr(str(msg.get("Reply-To", "")))[1] or None,
        "subject": str(msg.get("Subject", "")), "date": str(msg.get("Date", "")),
        "text": text.strip(), "html": html.get_content() if html else None, "attachments": atts,
    }


def heuristics(msg: EmailMessage, org: dict) -> list[dict]:
    known = org.get("contacts", []) + [{"name": org["name"], "domain": org["domain"]}]
    s = summarize(msg)
    ind: list[dict] = []

    def add(type_, severity, title, detail, quote=None):
        ind.append({"type": type_, "severity": severity, "title": title, "detail": detail, "quote": quote, "source": "kret"})

    sender = _domain_of(s["from_addr"])
    look = lookalike(sender, known)
    if look:
        add("lookalike_sender", "high", "Domena udaje znanego nadawcę",
            f"{look['name']} pisze z {look['domain']}. Ten mail przyszedł z {sender}.", sender)

    if s["reply_to"] and _domain_of(s["reply_to"]) != sender:
        add("reply_to_mismatch", "high", "Odpowiedź pójdzie gdzie indziej",
            f"Odpowiedź trafi na {s['reply_to']}, a nie do nadawcy.", s["reply_to"])

    auth = _auth_results(msg)
    if auth["dmarc"] in ("fail",) or auth["spf"] in ("fail", "softfail"):
        add("auth_fail", "medium", "Serwer nadawcy się nie zgadza",
            f"Kontrola poczty: SPF={auth['spf'] or '?'}, DKIM={auth['dkim'] or '?'}, DMARC={auth['dmarc'] or '?'}.")
    elif look and auth["spf"] == "pass":
        add("auth_pass_lookalike", "info", "Techniczne kontrole przechodzą, ale to nic nie znaczy",
            f"SPF=pass tylko potwierdza, że mail wysłał właściciel {sender}. Oszust kupił tę domenę.")

    body = s["text"]
    low = body.lower()
    for pat in ACCOUNT_CHANGE:
        m = re.search(pat, low)
        if m:
            add("account_change", "high", "Prośba o zmianę numeru konta",
                "Oszuści najczęściej zarabiają właśnie na „nowym numerze rachunku”.", body[m.start():m.end()])
            break
    iban = IBAN.search(body)
    if iban and not any(i["type"] == "account_change" for i in ind):
        add("iban", "medium", "Numer rachunku w treści", "Mail podaje numer konta do przelewu.", iban.group(0))
    for pat in URGENCY:
        m = re.search(pat, low)
        if m:
            add("urgency", "medium", "Presja czasu", "Pośpiech ma sprawić, że nikt nie sprawdzi.", body[m.start():m.end()])
            break

    html = s["html"] or ""
    if html:
        p = _Links()
        p.feed(html)
        for href, text in p.links:
            hd, td = _domain_of(href), _domain_of(text)
            if td and hd and td != hd:
                add("link_mismatch", "high", "Link prowadzi gdzie indziej, niż pokazuje",
                    f"Widać {td}, a link prowadzi do {hd}.", text)
            elif hd and lookalike(hd, known):
                add("lookalike_link", "high", "Link do podrobionej domeny", f"Link prowadzi do {hd}.", text or href)

    for part in msg.iter_attachments():
        name = (part.get_filename() or "").lower()
        payload = part.get_payload(decode=True) or b""
        exts = name.split(".")[1:]
        head = payload[:2000].decode("utf-8", errors="ignore").lower()
        if len(exts) >= 2 and exts[-2] in DOC_EXT and exts[-1] in RISKY_EXT:
            add("double_extension", "high", "Załącznik udaje dokument",
                f"„{part.get_filename()}” wygląda jak .{exts[-2]}, a naprawdę to .{exts[-1]}.", part.get_filename())
        elif exts and exts[-1] in RISKY_EXT:
            add("risky_attachment", "medium", "Ryzykowny typ załącznika", f"Pliki .{exts[-1]} często niosą złośliwe treści.", part.get_filename())
        declared = part.get_content_type()
        if declared == "application/pdf" and not payload.startswith(b"%PDF"):
            add("type_mismatch", "high", "To nie jest PDF", "Załącznik twierdzi, że jest PDF-em, ale w środku jest coś innego.")
        if "<form" in head or "<html" in head:
            lp = _Links()
            lp.feed(payload[:200_000].decode("utf-8", errors="ignore"))
            if lp.passwords:
                add("credential_form", "high", "Załącznik prosi o hasło",
                    "W środku jest formularz logowania. Kret otworzył go jako tekst: to podróbka strony banku.")
    return ind


def verdict_from(indicators: list[dict]) -> str:
    high = sum(1 for i in indicators if i["severity"] == "high")
    med = sum(1 for i in indicators if i["severity"] == "medium")
    if high >= 1 and high + med >= 2:
        return "danger"
    if high or med:
        return "caution"
    return "safe"


SYSTEM_PROMPT = """Jesteś cyberKretem, asystentem bezpieczeństwa w małej polskiej firmie. Działasz lokalnie, offline.
Dostajesz maila i listę faktów, które sprawdziły deterministyczne testy. Twoje zadanie: wytłumaczyć to pracownikowi bez wiedzy technicznej.
Zasady:
- Pisz po polsku, krótko, ciepło, bez żargonu. Zwracaj się do adresata po imieniu, jeśli je znasz.
- Nie wymyślaj faktów. Opieraj się na liście faktów i treści maila.
- Jeśli dodajesz własny sygnał, "quote" musi być dosłownym fragmentem treści maila.
- Nigdy nie każ klikać linków ani otwierać załącznika z tego maila.
Zwróć wyłącznie JSON:
{"verdict": "danger" | "caution" | "safe",
 "summary": "dwa zdania: co to jest i dlaczego",
 "what_to_do": "jedno konkretne zdanie: co zrobić teraz",
 "extra_signals": [{"title": "...", "quote": "dosłowny fragment", "explanation": "..."}]}"""

MAIL_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string", "enum": ["danger", "caution", "safe"]},
        "summary": {"type": "string"},
        "what_to_do": {"type": "string"},
        "extra_signals": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {"title": {"type": "string"}, "quote": {"type": "string"}, "explanation": {"type": "string"}},
                "required": ["title", "quote", "explanation"],
            },
        },
    },
    "required": ["verdict", "summary", "what_to_do", "extra_signals"],
}

ORDER = ["safe", "caution", "danger"]


def rules(msg: EmailMessage, org: dict) -> dict:
    s = summarize(msg)
    ind = heuristics(msg, org)
    verdict = verdict_from(ind)
    summary, what = _template(verdict, ind, org)
    return {
        "verdict": verdict, **VERDICT[verdict], "summary": summary, "what_to_do": what, "indicators": ind,
        "llm": {"model": None, "local": True, "ms": None, "error": "nie pytano modelu"},
        "mail": {k: v for k, v in s.items() if k != "html"},
    }


def explain(result: dict, msg: EmailMessage, org: dict, recipient_name: str | None = None) -> dict:
    s = summarize(msg)
    ind = [i for i in result["indicators"] if i["source"] != "model"]
    verdict = verdict_from(ind)
    facts = "\n".join(f"- {i['title']}: {i['detail']}" for i in ind) or "- brak sygnałów ostrzegawczych"
    user = (f"Adresat: {recipient_name or 'pracownik'}\nOd: {s['from_name']} <{s['from_addr']}>\n"
            f"Reply-To: {s['reply_to'] or '-'}\nTemat: {s['subject']}\n"
            f"Załączniki: {', '.join(a['filename'] for a in s['attachments']) or 'brak'}\n\n"
            f"Treść:\n{s['text'][:4000]}\n\nFakty sprawdzone przez kreta:\n{facts}\n"
            f"Werdykt testów: {verdict}")
    data, meta = ollama.chat_json(SYSTEM_PROMPT, user, MAIL_SCHEMA)
    summary = what = None
    if data:
        summary = str(data.get("summary") or "").strip() or None
        what = str(data.get("what_to_do") or "").strip() or None
        mv = data.get("verdict")
        if mv in ORDER and ORDER.index(mv) > ORDER.index(verdict):
            verdict = mv
        for x in data.get("extra_signals") or []:
            q = str(x.get("quote") or "").strip()
            if q and q in s["text"] and not any(i.get("quote") == q for i in ind):
                ind.append({"type": "llm", "severity": "medium", "title": str(x.get("title") or "Sygnał"),
                            "detail": str(x.get("explanation") or ""), "quote": q, "source": "model"})
    if not summary:
        summary, what = _template(verdict, ind, org)
    return {**result, "verdict": verdict, **VERDICT[verdict], "summary": summary, "what_to_do": what,
            "indicators": ind, "llm": meta}


def analyze(msg: EmailMessage, org: dict, recipient_name: str | None = None, use_llm: bool = True) -> dict:
    result = rules(msg, org)
    return explain(result, msg, org, recipient_name) if use_llm else result


def _template(verdict: str, ind: list[dict], org: dict) -> tuple[str, str]:
    if verdict == "safe":
        return "Kret nie znalazł nic podejrzanego. Nadawca się zgadza, nie ma prośby o pieniądze ani dziwnych załączników.", "Możesz odpowiedzieć normalnie."
    real = [i for i in ind if i["severity"] != "info"]
    titles = [i["title"].lower() for i in real if i["severity"] == "high"][:3] or [i["title"].lower() for i in real][:2]
    n = len(real)
    s = f"Kret znalazł {n} {'sygnał' if n == 1 else 'sygnały' if n < 5 else 'sygnałów'} oszustwa, m.in.: {', '.join(titles)}."
    if any(i["type"] in ("account_change", "iban") for i in ind):
        look = next((i for i in ind if i["type"] == "lookalike_sender"), None)
        phone = ""
        if look:
            c = next((c for c in org.get("contacts", []) if c["domain"] in look["detail"]), None)
            phone = f" ({c['phone']})" if c and c.get("phone") else ""
        return s + " To klasyczna próba wyłudzenia przelewu.", f"Nie płać. Zadzwoń do kontrahenta na numer z umowy{phone}, nie z tego maila."
    if verdict == "danger":
        return s + " Ten mail próbuje Cię oszukać.", "Nie klikaj linków i nie otwieraj załącznika. Zgłoś mail kretowi."
    return s, "Nie klikaj linku. Wejdź na stronę firmy sam, wpisując adres ręcznie."
