from app.kret.engine import run


def test_presentation_uses_real_rules_without_changing_saved_data(client, org):
    client.post("/api/org/new", json={"name": "Company outside the presentation"})
    saved = client.get("/api/org").json()
    runs = client.get("/api/kret/runs").json()
    incidents = client.get("/api/incidents").json()
    inbox = client.get("/api/mail").json()

    response = client.get("/api/demo/presentation")
    assert response.status_code == 200
    data = response.json()
    assert data["before"] == run(org)
    assert data["mail"]["verdict"] == "danger"
    assert data["mail"]["llm"]["model"] is None
    assert any(i["type"] == "lookalike_sender" for i in data["mail"]["indicators"])
    assert any(i["type"] == "account_change" for i in data["mail"]["indicators"])
    assert len(data["after"]["tunnels"]) == len(data["before"]["tunnels"]) - len(data["before"]["moves"][0]["closes"])
    assert "hold_payments" in {a["id"] for a in data["situation"]["plan"]}
    assert "bank_recall" not in {a["id"] for a in data["situation"]["plan"]}

    assert client.get("/api/org").json() == saved
    assert client.get("/api/kret/runs").json() == runs
    assert client.get("/api/incidents").json() == incidents
    assert client.get("/api/mail").json() == inbox
    assert client.get("/api/demo/presentation").json() == data
