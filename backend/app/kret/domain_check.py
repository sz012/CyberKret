import ipaddress
import re
import socket
import ssl
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urljoin, urlsplit

import dns.exception
import dns.resolver
import httpx

from ..db import now_iso
from ..schemas import DomainCheck, DomainFinding, SafeguardState

DOMAIN_PATTERN = re.compile(r"^(?=.{4,253}$)(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$")
DEMO_DOMAINS = {"saldo.example"}
DKIM_SELECTORS = ("google", "selector1", "selector2", "default", "k1", "mail", "dkim")
TIMEOUT_SECONDS = 5.0
MAX_REDIRECTS = 3
MAX_BODY_BYTES = 200_000
USER_AGENT = "CyberKret/0.1 (pasywne sprawdzenie domeny)"

MAIL_PROVIDERS = (
    ("protection.outlook.com", "Microsoft 365"),
    ("outlook.com", "Microsoft 365"),
    ("google.com", "Google Workspace"),
    ("googlemail.com", "Google Workspace"),
    ("zoho", "Zoho Mail"),
    ("ovh.net", "OVH"),
    ("home.pl", "home.pl"),
    ("nazwa.pl", "nazwa.pl"),
    ("cyberfolks", "cyber_Folks"),
    ("zenbox", "Zenbox"),
)
SECURITY_HEADERS = {
    "content-security-policy": "CSP",
    "x-frame-options": "X-Frame-Options",
    "x-content-type-options": "X-Content-Type-Options",
    "referrer-policy": "Referrer-Policy",
}
GENERATOR_PATTERN = re.compile(
    r"<meta[^>]+name=[\"']generator[\"'][^>]+content=[\"']([^\"']{1,80})[\"']", re.IGNORECASE
)
VERSION_PATTERN = re.compile(r"\d+\.\d+")

Resolve = Callable[[str, str], list[str]]


class DomainCheckError(ValueError):
    pass


@dataclass
class HttpReply:
    status: int
    headers: dict[str, str]
    body: str


FetchHttp = Callable[[str], HttpReply]
CertDaysLeft = Callable[[str], int]


def normalize_domain(raw: str) -> str:
    value = raw.strip().lower()
    if "://" in value:
        value = urlsplit(value).hostname or ""
    value = value.split("/")[0].split(":")[0].rstrip(".")
    if value.startswith("www."):
        value = value[4:]
    try:
        ipaddress.ip_address(value)
    except ValueError:
        pass
    else:
        raise DomainCheckError("Podaj nazwę domeny, nie adres IP.")
    if value == "localhost" or value.endswith(".localhost") or not DOMAIN_PATTERN.match(value):
        raise DomainCheckError("To nie wygląda na publiczną nazwę domeny, np. twojafirma.pl.")
    return value


def dns_resolve(name: str, rdtype: str) -> list[str]:
    try:
        answer = dns.resolver.resolve(name, rdtype, lifetime=TIMEOUT_SECONDS)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        return []
    except dns.exception.DNSException:
        return []
    if rdtype == "TXT":
        return [b"".join(record.strings).decode("utf-8", "replace") for record in answer]
    if rdtype == "MX":
        return [str(record.exchange).rstrip(".").lower() for record in answer]
    return [record.to_text() for record in answer]


def is_public_host(host: str, resolve: Resolve) -> bool:
    if not DOMAIN_PATTERN.match(host):
        return False
    addresses = resolve(host, "A") + resolve(host, "AAAA")
    if not addresses:
        return False
    return all(ipaddress.ip_address(address).is_global for address in addresses)


def http_fetch(url: str) -> HttpReply:
    with (
        httpx.Client(timeout=TIMEOUT_SECONDS, follow_redirects=False, headers={"User-Agent": USER_AGENT}) as client,
        client.stream("GET", url) as response,
    ):
        chunks = []
        size = 0
        for chunk in response.iter_bytes():
            chunks.append(chunk)
            size += len(chunk)
            if size >= MAX_BODY_BYTES:
                break
        body = b"".join(chunks).decode(response.encoding or "utf-8", "replace")
        return HttpReply(response.status_code, {k.lower(): v for k, v in response.headers.items()}, body)


def cert_days_left(host: str) -> int:
    context = ssl.create_default_context()
    with (
        socket.create_connection((host, 443), timeout=TIMEOUT_SECONDS) as raw,
        context.wrap_socket(raw, server_hostname=host) as tls,
    ):
        expires = ssl.cert_time_to_seconds(tls.getpeercert()["notAfter"])
    return int((datetime.fromtimestamp(expires, UTC) - datetime.now(UTC)).days)


def _mail_provider(mx_hosts: list[str]) -> str | None:
    for host in mx_hosts:
        for marker, name in MAIL_PROVIDERS:
            if marker in host:
                return name
    return None


def _check_mail(domain: str, resolve: Resolve) -> tuple[list[DomainFinding], str | None]:
    findings = []
    mx_hosts = resolve(domain, "MX")
    provider = _mail_provider(mx_hosts)
    if not mx_hosts:
        findings.append(
            DomainFinding(id="mx", label="Serwer poczty", status="info", detail="Domena nie ma rekordu MX.")
        )
    else:
        detail = f"Pocztę obsługuje {provider}." if provider else f"Serwer poczty: {mx_hosts[0]}."
        findings.append(DomainFinding(id="mx", label="Serwer poczty", status="info", detail=detail))

    spf = [r for r in resolve(domain, "TXT") if r.lower().startswith("v=spf1")]
    if not spf:
        findings.append(
            DomainFinding(
                id="spf",
                label="SPF",
                status="bad",
                detail="Brak rekordu SPF. Odbiorcy nie wiedzą, kto może wysyłać pocztę z tej domeny.",
            )
        )
    elif spf[0].rstrip().endswith(("-all", "~all")):
        findings.append(DomainFinding(id="spf", label="SPF", status="ok", detail=f"Rekord SPF jest: {spf[0][:120]}"))
    else:
        findings.append(
            DomainFinding(
                id="spf", label="SPF", status="warn", detail="Rekord SPF jest, ale nie kończy się na -all ani ~all."
            )
        )

    dmarc = [r for r in resolve(f"_dmarc.{domain}", "TXT") if r.lower().startswith("v=dmarc1")]
    if not dmarc:
        findings.append(
            DomainFinding(
                id="dmarc",
                label="DMARC",
                status="bad",
                detail="Brak rekordu DMARC. Każdy może wysłać maila podpisanego adresem z tej domeny, "
                "a skrzynki odbiorców nie mają podstaw, żeby go odrzucić.",
            )
        )
    else:
        policy = re.search(r"\bp=(\w+)", dmarc[0], re.IGNORECASE)
        value = policy.group(1).lower() if policy else "none"
        if value in ("quarantine", "reject"):
            findings.append(DomainFinding(id="dmarc", label="DMARC", status="ok", detail=f"DMARC z polityką {value}."))
        else:
            findings.append(
                DomainFinding(
                    id="dmarc",
                    label="DMARC",
                    status="warn",
                    detail="DMARC jest, ale z polityką none. Tylko raportuje, niczego nie blokuje.",
                )
            )

    selector = next(
        (s for s in DKIM_SELECTORS if any("p=" in r for r in resolve(f"{s}._domainkey.{domain}", "TXT"))), None
    )
    if selector:
        findings.append(
            DomainFinding(id="dkim", label="DKIM", status="ok", detail=f"Podpis DKIM znaleziony (selektor {selector}).")
        )
    else:
        findings.append(
            DomainFinding(
                id="dkim",
                label="DKIM",
                status="unknown",
                detail="Nie znalazłem podpisu DKIM w typowych miejscach. To nie znaczy, że go nie ma.",
            )
        )
    return findings, provider


def _check_web(domain: str, resolve: Resolve, fetch: FetchHttp, days_left: CertDaysLeft) -> list[DomainFinding]:
    if not is_public_host(domain, resolve):
        return [
            DomainFinding(
                id="https",
                label="Strona",
                status="info",
                detail="Pominąłem stronę: domena nie wskazuje na publiczny adres.",
            )
        ]
    findings = []
    try:
        plain = fetch(f"http://{domain}/")
        location = plain.headers.get("location", "")
        if plain.status in (301, 302, 307, 308) and location.startswith("https://"):
            findings.append(
                DomainFinding(id="https", label="HTTPS", status="ok", detail="Strona przekierowuje na HTTPS.")
            )
        else:
            findings.append(
                DomainFinding(
                    id="https", label="HTTPS", status="warn", detail="Wersja bez HTTPS nie przekierowuje na HTTPS."
                )
            )
    except (httpx.HTTPError, OSError):
        findings.append(
            DomainFinding(id="https", label="HTTPS", status="unknown", detail="Strona nie odpowiedziała po HTTP.")
        )

    reply = _fetch_https(domain, resolve, fetch)
    if reply is None:
        findings.append(
            DomainFinding(
                id="tls", label="Certyfikat", status="bad", detail="Nie udało się połączyć ze stroną po HTTPS."
            )
        )
        return findings

    if "strict-transport-security" in reply.headers:
        findings.append(
            DomainFinding(id="hsts", label="HSTS", status="ok", detail="Strona wymusza HTTPS nagłówkiem HSTS.")
        )
    else:
        findings.append(
            DomainFinding(id="hsts", label="HSTS", status="warn", detail="Strona nie wymusza HTTPS nagłówkiem HSTS.")
        )

    present = [label for header, label in SECURITY_HEADERS.items() if header in reply.headers]
    status = "ok" if len(present) >= 3 else "warn"
    detail = f"Nagłówki bezpieczeństwa: {', '.join(present)}." if present else "Brak nagłówków bezpieczeństwa."
    findings.append(DomainFinding(id="headers", label="Nagłówki", status=status, detail=detail))

    banner = " ".join(filter(None, (reply.headers.get("server"), reply.headers.get("x-powered-by"))))
    generator = GENERATOR_PATTERN.search(reply.body)
    leaked = [value for value in (banner, generator.group(1) if generator else "") if VERSION_PATTERN.search(value)]
    if leaked:
        findings.append(
            DomainFinding(
                id="generator",
                label="Wersja oprogramowania",
                status="warn",
                detail=f"Strona pokazuje wersję oprogramowania: {leaked[0][:60]}. Ułatwia to dobranie znanego błędu.",
            )
        )

    try:
        days = days_left(domain)
    except (OSError, ssl.SSLError, ValueError):
        findings.append(
            DomainFinding(id="tls", label="Certyfikat", status="unknown", detail="Nie udało się odczytać certyfikatu.")
        )
    else:
        tls_status = "bad" if days < 14 else "warn" if days < 30 else "ok"
        findings.append(
            DomainFinding(
                id="tls", label="Certyfikat", status=tls_status, detail=f"Certyfikat ważny jeszcze {days} dni."
            )
        )
    return findings


def _fetch_https(domain: str, resolve: Resolve, fetch: FetchHttp) -> HttpReply | None:
    url = f"https://{domain}/"
    for _ in range(MAX_REDIRECTS + 1):
        try:
            reply = fetch(url)
        except (httpx.HTTPError, OSError):
            return None
        location = reply.headers.get("location")
        if reply.status not in (301, 302, 303, 307, 308) or not location:
            return reply
        url = urljoin(url, location)
        parts = urlsplit(url)
        if parts.scheme != "https" or not parts.hostname or not is_public_host(parts.hostname, resolve):
            return reply
    return None


def check_domain(
    raw_domain: str,
    resolve: Resolve = dns_resolve,
    fetch: FetchHttp = http_fetch,
    days_left: CertDaysLeft = cert_days_left,
    demo_fixture: Callable[[], DomainCheck] | None = None,
) -> DomainCheck:
    domain = normalize_domain(raw_domain)
    if domain in DEMO_DOMAINS and demo_fixture is not None:
        return demo_fixture()
    mail_findings, provider = _check_mail(domain, resolve)
    web_findings = _check_web(domain, resolve, fetch, days_left)
    return DomainCheck(
        domain=domain,
        checked_at=now_iso(),
        demo=False,
        mail_provider=provider,
        findings=[*mail_findings, *web_findings],
    )


def safeguard_states(check: DomainCheck) -> dict[str, SafeguardState]:
    mapping = {"spf": "domain_spf", "dmarc": "domain_dmarc", "dkim": "domain_dkim"}
    states: dict[str, SafeguardState] = {}
    for finding in check.findings:
        safeguard = mapping.get(finding.id)
        if safeguard is None:
            continue
        if finding.status == "ok":
            states[safeguard] = "present"
        elif finding.status in ("bad", "warn"):
            states[safeguard] = "missing"
        else:
            states[safeguard] = "unknown"
    return states
