from app import config
from app.mail import analyze as an

EMAILS = config.SEED_DIR / "emails"


def load(name):
    return an.parse((EMAILS / name).read_text())


def test_phishing_is_danger_with_key_signals(org):
    r = an.analyze(load("01_biurex_phishing.eml"), org, use_llm=False)
    types = {i["type"] for i in r["indicators"]}
    assert r["verdict"] == "danger"
    assert {"lookalike_sender", "reply_to_mismatch", "account_change", "urgency", "double_extension",
            "type_mismatch", "credential_form", "link_mismatch"} <= types
    assert "12 345 67 89" in r["what_to_do"]


def test_legit_client_and_boss_are_safe(org):
    for name in ("02_lis_client.eml", "04_boss_hearing.eml"):
        assert an.analyze(load(name), org, use_llm=False)["verdict"] == "safe", name


def test_parcel_scam_link_mismatch(org):
    r = an.analyze(load("03_courier_fee.eml"), org, use_llm=False)
    assert r["verdict"] == "danger"
    assert "link_mismatch" in {i["type"] for i in r["indicators"]}


def test_lookalike():
    known = [{"name": "Biurex", "domain": "biurex.example"}]
    assert an.lookalike("biurex-pl.example", known)
    assert an.lookalike("biurrex.example", known)
    assert not an.lookalike("biurex.example", known)
    assert not an.lookalike("mail.biurex.example", known)
    assert not an.lookalike("lis-transport.example", known)
