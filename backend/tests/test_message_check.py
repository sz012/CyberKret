from typing import Any

from fastapi.testclient import TestClient

from app.llm.message_check import analyze_message
from app.schemas import Organization


class FakeModel:
    model = "fake"

    def __init__(self, reply: dict[str, Any] | None) -> None:
        self.reply = reply

    def chat_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any] | None:
        return self.reply


def test_sample_message_is_suspicious_by_rules(org: Organization) -> None:
    result = analyze_message(org.sample_message, org, None)
    kinds = {i.type for i in result.indicators}
    assert result.verdict == "suspicious"
    assert result.mode == "rules"
    assert {"account_change", "account_number", "urgency", "no_verification", "reply_to_mismatch", "pretext"} <= kinds
    assert "Nadawca podpisuje się adresem biuro@saldo.example." in result.facts
    for indicator in result.indicators:
        assert org.sample_message[indicator.start : indicator.end] == indicator.quote


def test_model_quotes_must_exist_in_text(org: Organization) -> None:
    reply = {
        "verdict": "suspicious",
        "summary": "Podejrzana wiadomość.",
        "indicators": [
            {"type": "other", "quote": "biuro jest dziś zamknięte z powodu szkolenia", "explanation": "Wymówka."},
            {"type": "other", "quote": "tego zdania nie ma w wiadomości", "explanation": "Zmyślone."},
        ],
    }
    result = analyze_message(org.sample_message, org, FakeModel(reply))
    model_quotes = [i.quote for i in result.indicators if i.source == "model"]
    assert result.mode == "model"
    assert model_quotes == ["biuro jest dziś zamknięte z powodu szkolenia"]
    assert result.summary == "Podejrzana wiadomość."


def test_model_cannot_downgrade_rules(org: Organization) -> None:
    reply = {"verdict": "likely_safe", "summary": "Wszystko w porządku.", "indicators": []}
    result = analyze_message(org.sample_message, org, FakeModel(reply))
    assert result.verdict == "suspicious"
    assert result.summary != "Wszystko w porządku."


def test_lookalike_domain_is_flagged(org: Organization) -> None:
    text = "Od: Biuro <faktury@sa1do.example>\nProsimy o przelew na nowy rachunek."
    result = analyze_message(text, org, None)
    assert "lookalike_domain" in {i.type for i in result.indicators}


def test_plain_message_is_unclear_not_safe(org: Organization) -> None:
    result = analyze_message("Dzień dobry, przesyłam fakturę za październik.", org, FakeModel(None))
    assert result.verdict == "unclear"
    assert result.note is not None


def test_api_falls_back_to_rules_without_ollama(client: TestClient, org: Organization) -> None:
    response = client.post("/api/analyze-message", json={"text": org.sample_message})
    body = response.json()
    assert response.status_code == 200
    assert body["mode"] == "rules"
    assert body["verdict"] == "suspicious"
