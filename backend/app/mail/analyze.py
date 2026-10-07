"""Mail mole: deterministic checks of a message first, the local model only explains them.

Attachments are read as bytes and text. Nothing is executed or rendered.
"""
import re
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, parseaddr
from html.parser import HTMLParser

from ..llm import ollama

URGENCY = [r"\burgent\w*", r"immediately", r"by the end of (the )?day", r"within 24", r"\btoday\b", r"\b(suspended|blocked|locked)\b", r"final (notice|reminder)",
           r"\bpiln\w*", r"natychmiast", r"do końca dnia", r"w ciągu 24", r"dzisiaj", r"zablokowan\w*", r"wstrzyma\w*", r"ostatni\w* termin"]
ACCOUNT_CHANGE = [r"new (bank )?account (number|details)", r"(changed|change of|updated?) (our )?(bank|bank account|account details|banking details)",
                  r"(now\w*|zmian\w*|aktualizacj\w*)\s+(numer\w*\s+)?(rachunk\w*|kont\w* bankow\w*)", r"numer\w* rachunk\w*"]
IBAN = re.compile(r"\b(?:[A-Z]{2}\s?)?\d{2}(?:\s?\d{4}){6}\b")
RISKY_EXT = {"exe", "scr", "js", "vbs", "bat", "cmd", "iso", "img", "lnk", "hta", "html", "htm", "docm", "xlsm", "zip", "rar", "7z"}
DOC_EXT = {"pdf", "doc", "docx", "xls", "xlsx", "jpg", "png", "txt"}

VERDICT = {
    "danger": {"label": "Do not open, report it", "level": "bad"},
    "caution": {"label": "Check before you click", "level": "warn"},
    "safe": {"label": "Looks safe", "level": "ok"},
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
        atts.append({"filename": part.get_filename() or "unnamed", "content_type": part.get_content_type(), "size": len(payload)})
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
        add("lookalike_sender", "high", "The domain imitates a known sender",
            f"{look['name']} writes from {look['domain']}. This email came from {sender}.", sender)

    if s["reply_to"] and _domain_of(s["reply_to"]) != sender:
        add("reply_to_mismatch", "high", "Your reply goes somewhere else",
            f"A reply goes to {s['reply_to']}, not to the sender.", s["reply_to"])

    auth = _auth_results(msg)
    if auth["dmarc"] in ("fail",) or auth["spf"] in ("fail", "softfail"):
        add("auth_fail", "medium", "The sender's server does not match",
            f"Email checks: SPF={auth['spf'] or '?'}, DKIM={auth['dkim'] or '?'}, DMARC={auth['dmarc'] or '?'}.")
    elif look and auth["spf"] == "pass":
        add("auth_pass_lookalike", "info", "Technical checks pass, but that means nothing",
            f"SPF=pass only confirms the email was sent by the owner of {sender}. The fraudster bought that domain.")

    body = s["text"]
    low = body.lower()
    for pat in ACCOUNT_CHANGE:
        m = re.search(pat, low)
        if m:
            add("account_change", "high", "A request to change the bank account",
                "A \"new account number\" is how fraudsters most often get paid.", body[m.start():m.end()])
            break
    iban = IBAN.search(body)
    if iban and not any(i["type"] == "account_change" for i in ind):
        add("iban", "medium", "Account number in the text", "The email gives an account number for a payment.", iban.group(0))
    for pat in URGENCY:
        m = re.search(pat, low)
        if m:
            add("urgency", "medium", "Time pressure", "The rush is meant to stop anyone from checking.", body[m.start():m.end()])
            break

    html = s["html"] or ""
    if html:
        p = _Links()
        p.feed(html)
        for href, text in p.links:
            hd, td = _domain_of(href), _domain_of(text)
            if td and hd and td != hd:
                add("link_mismatch", "high", "The link goes somewhere other than it shows",
                    f"It shows {td}, but the link goes to {hd}.", text)
            elif hd and lookalike(hd, known):
                add("lookalike_link", "high", "A link to a forged domain", f"The link goes to {hd}.", text or href)

    for part in msg.iter_attachments():
        name = (part.get_filename() or "").lower()
        payload = part.get_payload(decode=True) or b""
        exts = name.split(".")[1:]
        head = payload[:2000].decode("utf-8", errors="ignore").lower()
        if len(exts) >= 2 and exts[-2] in DOC_EXT and exts[-1] in RISKY_EXT:
            add("double_extension", "high", "The attachment pretends to be a document",
                f"\"{part.get_filename()}\" looks like a .{exts[-2]} file, but it is really .{exts[-1]}.", part.get_filename())
        elif exts and exts[-1] in RISKY_EXT:
            add("risky_attachment", "medium", "Risky attachment type", f".{exts[-1]} files often carry malicious content.", part.get_filename())
        declared = part.get_content_type()
        if declared == "application/pdf" and not payload.startswith(b"%PDF"):
            add("type_mismatch", "high", "This is not a PDF", "The attachment claims to be a PDF, but there is something else inside.")
        if "<form" in head or "<html" in head:
            lp = _Links()
            lp.feed(payload[:200_000].decode("utf-8", errors="ignore"))
            if lp.passwords:
                add("credential_form", "high", "The attachment asks for a password",
                    "There is a login form inside. The mole opened it as text: it is a forged bank page.")
    return ind


def verdict_from(indicators: list[dict]) -> str:
    high = sum(1 for i in indicators if i["severity"] == "high")
    med = sum(1 for i in indicators if i["severity"] == "medium")
    if high >= 1 and high + med >= 2:
        return "danger"
    if high or med:
        return "caution"
    return "safe"


SYSTEM_PROMPT = """You are cyberMole, a security assistant in a small company. You run locally, offline.
You get an email and a list of facts checked by deterministic tests. Your job: explain it to an employee with no technical knowledge.
Rules:
- Always write in English, even when the email is in another language. Be brief, warm and free of jargon. Address the recipient by first name if you know it.
- Do not invent facts. Rely on the list of facts and the text of the email.
- If you add a signal of your own, "quote" must be a verbatim fragment of the email text.
- Never tell anyone to click links or open attachments from this email.
Return JSON only:
{"verdict": "danger" | "caution" | "safe",
 "summary": "two sentences: what this is and why",
 "what_to_do": "one concrete sentence: what to do now",
 "extra_signals": [{"title": "...", "quote": "verbatim fragment", "explanation": "..."}]}"""

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
        "llm": {"model": None, "local": True, "ms": None, "error": "model not asked"},
        "mail": {k: v for k, v in s.items() if k != "html"},
    }


def explain(result: dict, msg: EmailMessage, org: dict, recipient_name: str | None = None) -> dict:
    s = summarize(msg)
    ind = [i for i in result["indicators"] if i["source"] != "model"]
    verdict = verdict_from(ind)
    facts = "\n".join(f"- {i['title']}: {i['detail']}" for i in ind) or "- no warning signs"
    user = (f"Recipient: {recipient_name or 'employee'}\nFrom: {s['from_name']} <{s['from_addr']}>\n"
            f"Reply-To: {s['reply_to'] or '-'}\nSubject: {s['subject']}\n"
            f"Attachments: {', '.join(a['filename'] for a in s['attachments']) or 'none'}\n\n"
            f"Text:\n{s['text'][:4000]}\n\nFacts checked by the mole:\n{facts}\n"
            f"Test verdict: {verdict}\nAnswer in English.")
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
                ind.append({"type": "llm", "severity": "medium", "title": str(x.get("title") or "Signal"),
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
        return "The mole found nothing suspicious. The sender checks out, and there is no request for money and no strange attachment.", "You can reply as usual."
    real = [i for i in ind if i["severity"] != "info"]
    titles = [i["title"].lower() for i in real if i["severity"] == "high"][:3] or [i["title"].lower() for i in real][:2]
    n = len(real)
    s = f"The mole found {n} {'sign' if n == 1 else 'signs'} of fraud, including: {', '.join(titles)}."
    if any(i["type"] in ("account_change", "iban") for i in ind):
        look = next((i for i in ind if i["type"] == "lookalike_sender"), None)
        phone = ""
        if look:
            c = next((c for c in org.get("contacts", []) if c["domain"] in look["detail"]), None)
            phone = f" ({c['phone']})" if c and c.get("phone") else ""
        return s + " This is a classic attempt to steal a payment.", f"Do not pay. Call the vendor on the number from the contract{phone}, not the one in this email."
    if verdict == "danger":
        return s + " This email is trying to trick you.", "Do not click links or open the attachment. Report the email to the mole."
    return s, "Do not click the link. Go to the company's website yourself by typing the address."
