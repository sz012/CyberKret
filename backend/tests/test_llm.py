"""The model may explain and raise the alarm, never invent quotes or lower a verdict."""
import json

import httpx

from app import config
from app.llm import explain, ollama
from app.mail import analyze as an


class FakeResp:
    def __init__(self, content: dict):
        self.status_code = 200
        self.text = ""
        self._content = content

    def raise_for_status(self):
        pass

    def json(self):
        return {"message": {"content": json.dumps(self._content, ensure_ascii=False)}}


def fake_model(monkeypatch, content: dict):
    monkeypatch.setattr(ollama, "model", lambda: "qwen-test")
    sent = {}

    def post(url, json=None, timeout=None):
        sent["body"] = json
        return FakeResp(content)

    monkeypatch.setattr(httpx, "post", post)
    return sent


def load(name):
    return an.parse((config.SEED_DIR / "emails" / name).read_text())


def test_model_cannot_lower_verdict_and_bad_quotes_are_dropped(monkeypatch, org):
    sent = fake_model(monkeypatch, {
        "verdict": "safe",
        "summary": "Pani Grażyno, to oszustwo.",
        "what_to_do": "Proszę nie płacić.",
        "extra_signals": [
            {"title": "Grzecznościowa formuła", "quote": "Dział Księgowości", "explanation": "x"},
            {"title": "Zmyślony cytat", "quote": "przelej bitcoiny", "explanation": "x"},
        ],
    })
    r = an.analyze(load("01_biurex_phishing.eml"), org, recipient_name="Pani Grażyna")
    assert r["verdict"] == "danger"
    assert r["summary"] == "Pani Grażyno, to oszustwo."
    quotes = [i["quote"] for i in r["indicators"] if i["source"] == "model"]
    assert quotes == ["Dział Księgowości"]
    assert r["llm"]["model"] == "qwen-test"
    assert sent["body"]["format"] == "json" and sent["body"]["stream"] is False


def test_model_can_raise_alarm(monkeypatch, org):
    fake_model(monkeypatch, {"verdict": "caution", "summary": "Nietypowa prośba.", "what_to_do": "Zadzwoń.", "extra_signals": []})
    r = an.analyze(load("02_lis_klient.eml"), org)
    assert r["verdict"] == "caution"


def test_fallback_without_model(monkeypatch, org):
    monkeypatch.setattr(ollama, "model", lambda: None)
    r = an.analyze(load("01_biurex_phishing.eml"), org)
    assert r["verdict"] == "danger" and r["llm"]["error"] == "brak lokalnego modelu"
    assert "Nie płać" in r["what_to_do"]


def test_kret_story_uses_model(monkeypatch, org):
    from app.kret import engine

    fake_model(monkeypatch, {"headline": "Wszedłbym przez pulpit szefa.", "story": "...", "first_step": "Zamknij RDP."})
    s = explain.kret_story(engine.run(org))
    assert s["headline"] == "Wszedłbym przez pulpit szefa."


def test_garbage_from_model_falls_back(monkeypatch, org):
    from app.kret import engine

    monkeypatch.setattr(ollama, "model", lambda: "qwen-test")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: (_ for _ in ()).throw(httpx.ReadTimeout("slow")))
    s = explain.kret_story(engine.run(org))
    assert s["headline"].startswith("Kret znalazł") and s["llm"]["error"] == "ReadTimeout"
