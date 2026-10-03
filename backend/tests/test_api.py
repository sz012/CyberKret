from fastapi.testclient import TestClient


def test_health_reports_missing_model(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["llm"] == {"available": False, "model": "test-model"}


def test_org_safeguard_update_and_reset(client: TestClient) -> None:
    updated = client.patch("/api/org/safeguards/email_mfa", json={"state": "present"})
    assert updated.status_code == 200
    assert next(s for s in updated.json()["safeguards"] if s["id"] == "email_mfa")["state"] == "present"
    assert client.patch("/api/org/safeguards/nope", json={"state": "present"}).status_code == 404

    client.post("/api/demo/reset")
    org = client.get("/api/org").json()
    assert next(s for s in org["safeguards"] if s["id"] == "email_mfa")["state"] == "missing"
    assert [entry["kind"] for entry in client.get("/api/log").json()] == ["demo_reset"]


def test_kret_run_is_stored_and_logged(client: TestClient) -> None:
    assert client.get("/api/kret/runs/latest").json() is None
    run = client.post("/api/kret/run").json()
    assert run["id"] == 1
    assert run["total"] == 11
    latest = client.get("/api/kret/runs/latest").json()
    assert latest["id"] == 1
    assert client.get("/api/kret/runs").json()[0]["total"] == 11
    assert client.get("/api/log").json()[0]["kind"] == "kret_run"


def test_incident_catalog_lists_questions(client: TestClient) -> None:
    catalog = client.get("/api/incident-types").json()
    assert [t["id"] for t in catalog["types"] if t["available"]] == ["payment_fraud"]
    assert [q["id"] for q in catalog["questions"] if q["in_form"]] == ["Q1", "Q2", "Q3", "Q4", "Q5"]
    assert "biuro@saldo.example" in catalog["questions"][1]["text"]
