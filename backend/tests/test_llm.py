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
        "summary": "Grace, this is a scam.",
        "what_to_do": "Please do not pay.",
        "extra_signals": [
            {"title": "Polite sign-off", "quote": "Accounts Department", "explanation": "x"},
            {"title": "Made-up quote", "quote": "send bitcoin", "explanation": "x"},
        ],
    })
    r = an.analyze(load("01_biurex_phishing.eml"), org, recipient_name="Grace")
    assert r["verdict"] == "danger"
    assert r["summary"] == "Grace, this is a scam."
    quotes = [i["quote"] for i in r["indicators"] if i["source"] == "model"]
    assert quotes == ["Accounts Department"]
    assert r["llm"]["model"] == "qwen-test"
    assert sent["body"]["format"]["required"] == ["verdict", "summary", "what_to_do", "extra_signals"]
    assert sent["body"]["stream"] is False and sent["body"]["options"]["num_ctx"] == config.OLLAMA_CTX
    assert "JSON Schema" in sent["body"]["messages"][0]["content"]


def test_model_can_raise_alarm(monkeypatch, org):
    fake_model(monkeypatch, {"verdict": "caution", "summary": "Unusual request.", "what_to_do": "Call them.", "extra_signals": []})
    r = an.analyze(load("02_lis_client.eml"), org)
    assert r["verdict"] == "caution"


def test_fallback_without_model(monkeypatch, org):
    monkeypatch.setattr(ollama, "model", lambda: None)
    r = an.analyze(load("01_biurex_phishing.eml"), org)
    assert r["verdict"] == "danger" and r["llm"]["error"] == "no local model"
    assert "Do not pay" in r["what_to_do"]


def test_kret_story_uses_model(monkeypatch, org):
    from app.kret import engine

    fake_model(monkeypatch, {"headline": "I would get in through the owner's desktop.", "story": "...", "first_step": "Close RDP."})
    s = explain.kret_story(engine.run(org))
    assert s["headline"] == "I would get in through the owner's desktop."


def test_garbage_from_model_falls_back(monkeypatch, org):
    from app.kret import engine

    monkeypatch.setattr(ollama, "model", lambda: "qwen-test")
    monkeypatch.setattr(httpx, "post", lambda *a, **k: (_ for _ in ()).throw(httpx.ReadTimeout("slow")))
    s = explain.kret_story(engine.run(org))
    assert s["headline"].startswith("The mole found") and s["llm"]["error"] == "ReadTimeout"
