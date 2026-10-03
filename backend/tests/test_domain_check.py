import pytest
from fastapi.testclient import TestClient

from app.kret.domain_check import DomainCheckError, HttpReply, check_domain, normalize_domain, safeguard_states
from app.seed import load_domain_fixture

RECORDS = {
    ("firma.pl", "MX"): ["firma-pl.mail.protection.outlook.com"],
    ("firma.pl", "TXT"): ["v=spf1 include:spf.protection.outlook.com -all"],
    ("_dmarc.firma.pl", "TXT"): ["v=DMARC1; p=none; rua=mailto:dmarc@firma.pl"],
    ("firma.pl", "A"): ["93.184.215.14"],
}


def resolve(name: str, rdtype: str) -> list[str]:
    return RECORDS.get((name, rdtype), [])


def fetch(url: str) -> HttpReply:
    if url.startswith("http://"):
        return HttpReply(301, {"location": "https://firma.pl/"}, "")
    return HttpReply(
        200,
        {"server": "nginx/1.18.0", "x-content-type-options": "nosniff"},
        '<meta name="generator" content="WordPress 6.4.2">',
    )


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://www.Firma.pl/kontakt", "firma.pl"),
        (" firma.pl. ", "firma.pl"),
        ("sklep.firma.com.pl", "sklep.firma.com.pl"),
    ],
)
def test_normalize_accepts_domains(raw: str, expected: str) -> None:
    assert normalize_domain(raw) == expected


@pytest.mark.parametrize("raw", ["127.0.0.1", "localhost", "intranet", "http://10.0.0.1/", "a..pl"])
def test_normalize_rejects_non_public_names(raw: str) -> None:
    with pytest.raises(DomainCheckError):
        normalize_domain(raw)


def test_check_reads_mail_and_web_findings() -> None:
    check = check_domain("firma.pl", resolve=resolve, fetch=fetch, days_left=lambda host: 20)
    status = {f.id: f.status for f in check.findings}
    assert check.mail_provider == "Microsoft 365"
    assert status["spf"] == "ok"
    assert status["dmarc"] == "warn"
    assert status["dkim"] == "unknown"
    assert status["https"] == "ok"
    assert status["hsts"] == "warn"
    assert status["generator"] == "warn"
    assert status["tls"] == "warn"
    assert safeguard_states(check) == {"domain_spf": "present", "domain_dmarc": "missing", "domain_dkim": "unknown"}


def test_private_address_skips_web_requests() -> None:
    def private_resolve(name: str, rdtype: str) -> list[str]:
        return ["10.0.0.5"] if rdtype == "A" else []

    def forbidden_fetch(url: str) -> HttpReply:
        raise AssertionError("no request expected")

    check = check_domain("firma.pl", resolve=private_resolve, fetch=forbidden_fetch, days_left=lambda host: 90)
    assert next(f for f in check.findings if f.id == "https").status == "info"


def test_demo_domain_uses_fixture() -> None:
    check = check_domain("saldo.example", demo_fixture=load_domain_fixture)
    assert check.demo is True
    assert check.checked_at


def test_api_requires_consent_and_applies_to_org(client: TestClient) -> None:
    assert client.post("/api/kret/domain-check", json={"domain": "saldo.example", "consent": False}).status_code == 400
    response = client.post("/api/kret/domain-check", json={"domain": "saldo.example", "consent": True}).json()
    assert response["applied"] is True
    org = client.get("/api/org").json()
    states = {s["id"]: (s["state"], s["source"]) for s in org["safeguards"]}
    assert states["domain_dmarc"] == ("missing", "kret")
    assert org["domain_check"]["demo"] is True
