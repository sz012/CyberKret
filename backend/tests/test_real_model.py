"""Smoke test with the real local model. Skipped when Ollama has no model. Run with -s to see answers and timings."""
import pytest

from app import config
from app.kret import engine
from app.llm import explain, ollama
from app.mail import analyze as an


@pytest.fixture
def real_model(monkeypatch):
    monkeypatch.setattr(config, "LLM_DISABLED", False)
    monkeypatch.setattr(ollama, "_resolved_model", None)
    if not ollama.list_models():
        pytest.skip("Ollama nie działa albo nie ma pobranego modelu")
    return ollama.model()


def polish(text: str) -> bool:
    return any(ch in text for ch in "ąćęłńóśźż") and len(text.split()) >= 5


def test_model_explains_phishing_in_polish(real_model, org):
    msg = an.parse((config.SEED_DIR / "emails" / "01_biurex_phishing.eml").read_text())
    r = an.analyze(msg, org, recipient_name="Grażyna")
    print(f"\n[{real_model}] {r['llm']['ms']} ms\nwerdykt: {r['verdict']}\n{r['summary']}\nco zrobić: {r['what_to_do']}")
    assert r["llm"]["error"] is None, r["llm"]
    assert r["verdict"] == "danger"
    assert polish(r["summary"]) and r["what_to_do"]


def test_model_tells_the_kret_story(real_model, org):
    s = explain.kret_story(engine.run(org))
    print(f"\n[{real_model}] {s['llm']['ms']} ms\n{s['headline']}\n{s['story']}\n{s['first_step']}")
    assert s["llm"]["error"] is None and polish(s["story"])


def test_model_writes_incident_brief(real_model, client):
    inc = client.post("/api/incidents", json={"type": "ransomware"}).json()
    b = explain.incident_brief(inc["situation"])
    print(f"\n[{real_model}] {b['llm']['ms']} ms\n{b['brief']}\nteraz: {b['next']}")
    assert b["llm"]["error"] is None and polish(b["brief"])
