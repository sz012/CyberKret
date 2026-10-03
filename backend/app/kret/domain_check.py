"""Passive domain check: DNS records and one GET of the home page. No ports, no admin paths, no logins."""
import ipaddress
import json
import re
import socket
import ssl
from datetime import datetime, timezone

import dns.exception
import dns.resolver
import httpx

from .. import config

DOMAIN_RE = re.compile(r"^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$")
DKIM_SELECTORS = ["selector1", "selector2", "google", "default"]
TIMEOUT = 5.0
SECURITY_HEADERS = {
    "strict-transport-security": "HSTS",
    "content-security-policy": "CSP",
    "x-content-type-options": "X-Content-Type-Options",
    "x-frame-options": "X-Frame-Options",
}


class DomainError(ValueError):
    pass


def normalize(domain: str) -> str:
    d = domain.strip().lower().removeprefix("https://").removeprefix("http://").split("/")[0].removeprefix("www.")
    if not DOMAIN_RE.match(d):
        raise DomainError("To nie wygląda na nazwę domeny, np. kancelaria-nowak.pl")
    return d


def _txt(name: str) -> list[str]:
    try:
        ans = dns.resolver.resolve(name, "TXT", lifetime=TIMEOUT)
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        return []
    return [b"".join(r.strings).decode(errors="replace") for r in ans]


def _public_ips(domain: str) -> list[str]:
    ips = []
    for rtype in ("A", "AAAA"):
        try:
            ips += [r.to_text() for r in dns.resolver.resolve(domain, rtype, lifetime=TIMEOUT)]
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            pass
    for ip in ips:
        if not ipaddress.ip_address(ip).is_global:
            raise DomainError("Domena wskazuje na adres prywatny lub lokalny. Kret tego nie sprawdza.")
    return ips


def _cert_days(domain: str, ip: str) -> int | None:
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((ip, 443), timeout=TIMEOUT) as sock:
            with ctx.wrap_socket(sock, server_hostname=domain) as tls:
                not_after = tls.getpeercert()["notAfter"]
    except (OSError, ssl.SSLError, KeyError):
        return None
    exp = datetime.fromtimestamp(ssl.cert_time_to_seconds(not_after), timezone.utc)
    return (exp - datetime.now(timezone.utc)).days


def check(domain: str) -> dict:
    d = normalize(domain)
    if d.endswith(".example"):
        data = json.loads((config.SEED_DIR / "domain_fixture.json").read_text())
        return {**data, "domain": d, "demo": True}

    findings: list[dict] = []

    def add(key, level, title, detail):
        findings.append({"key": key, "level": level, "title": title, "detail": detail})

    try:
        mx = sorted(r.exchange.to_text().rstrip(".") for r in dns.resolver.resolve(d, "MX", lifetime=TIMEOUT))
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        mx = []
    except dns.exception.Timeout:
        raise DomainError("Serwer DNS nie odpowiada. Spróbuj ponownie.")
    provider = next((p for k, p in [("outlook", "Microsoft 365"), ("google", "Google Workspace"), ("ovh", "OVH"),
                                    ("home.pl", "home.pl"), ("nazwa.pl", "nazwa.pl")] if any(k in m for m in mx)), None)
    add("mx", "ok" if mx else "warn", "Serwery poczty", ", ".join(mx) if mx else "Brak rekordu MX, domena nie odbiera poczty.")

    spf = [t for t in _txt(d) if t.lower().startswith("v=spf1")]
    if not spf:
        add("spf", "bad", "SPF", "Brak rekordu SPF. Każdy serwer może wysyłać pocztę jako ta domena.")
    else:
        weak = spf[0].rstrip().endswith(("+all", "?all"))
        add("spf", "warn" if weak else "ok", "SPF", spf[0])

    dmarc = [t for t in _txt(f"_dmarc.{d}") if t.lower().startswith("v=dmarc1")]
    if not dmarc:
        add("dmarc", "bad", "DMARC", "Brak rekordu DMARC. Fałszywe maile „od tej domeny” nie zostaną odrzucone.")
    else:
        m = re.search(r"\bp=(\w+)", dmarc[0])
        policy = m.group(1).lower() if m else "none"
        add("dmarc", "ok" if policy in ("reject", "quarantine") else "warn", "DMARC",
            f"Polityka p={policy}. " + ("Fałszywe maile są odrzucane." if policy != "none" else "Tylko monitoring, nic nie jest blokowane."))

    dkim = [s for s in DKIM_SELECTORS if _txt(f"{s}._domainkey.{d}")]
    add("dkim", "ok" if dkim else "warn", "DKIM",
        f"Znaleziony selektor: {', '.join(dkim)}" if dkim else "Nie znaleziono typowych selektorów (może używać innych).")

    ips = _public_ips(d)
    web: dict = {}
    if ips:
        days = _cert_days(d, ips[0])
        if days is None:
            add("cert", "bad", "Certyfikat HTTPS", "Nie udało się nawiązać połączenia HTTPS.")
        else:
            add("cert", "ok" if days > 14 else "warn", "Certyfikat HTTPS", f"Ważny jeszcze {days} dni.")
        try:
            with httpx.Client(timeout=TIMEOUT, follow_redirects=False, headers={"User-Agent": "cyberKret/0.1 (passive check)"}) as cli:
                r = cli.get(f"http://{d}/")
                loc = r.headers.get("location", "")
                add("https_redirect", "ok" if loc.startswith("https://") else "warn", "Przekierowanie na HTTPS",
                    "HTTP przekierowuje na HTTPS." if loc.startswith("https://") else "Strona otwiera się też bez szyfrowania.")
                r = cli.get(f"https://{d}/")
                h = {k.lower(): v for k, v in r.headers.items()}
                missing = [label for k, label in SECURITY_HEADERS.items() if k not in h]
                add("headers", "ok" if len(missing) <= 1 else "warn", "Nagłówki bezpieczeństwa",
                    "Brakuje: " + ", ".join(missing) if missing else "Komplet podstawowych nagłówków.")
                gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']+)', r.text[:200_000], re.I)
                leaks = [x for x in (h.get("server"), h.get("x-powered-by"), gen.group(1) if gen else None) if x]
                if leaks:
                    add("version", "warn", "Strona zdradza oprogramowanie", "; ".join(leaks))
                web = {"status": r.status_code}
        except httpx.HTTPError:
            add("https_redirect", "warn", "Strona WWW", "Strona nie odpowiedziała w 5 sekund.")
    else:
        add("cert", "warn", "Strona WWW", "Domena nie ma adresu strony.")

    return {"domain": d, "demo": False, "provider": provider, "findings": findings, "web": web,
            "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def apply_to_org(org: dict, result: dict) -> list[str]:
    """Copy results onto the org's domain safeguards with source 'kret'. Returns changed safeguard ids."""
    mapping = {"spf": "domain_spf", "dmarc": "domain_dmarc", "cert": "website_https"}
    by_key = {f["key"]: f for f in result["findings"]}
    changed = []
    for s in org["safeguards"]:
        for key, sid in mapping.items():
            if s["id"] == sid and key in by_key:
                f = by_key[key]
                s["state"] = "present" if f["level"] == "ok" else "missing"
                s["source"] = "kret"
                s["evidence"] = f["detail"]
                changed.append(sid)
    return changed
