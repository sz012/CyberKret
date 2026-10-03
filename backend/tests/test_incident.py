from fastapi.testclient import TestClient

from app.db import IncidentRecord
from app.incident import engine
from app.incident import playbook_payment_fraud as payment_fraud
from app.schemas import Organization

FORM = {"Q1": "not_yet", "Q2": "unknown", "Q3": "unknown", "Q4": "partly", "Q5": "deadlines"}


def record(answers: dict[str, str], **extra: object) -> IncidentRecord:
    base = {
        "id": 1,
        "org_id": "saldo",
        "type": "payment_fraud",
        "status": "open",
        "answers": {**payment_fraud.defaults(), **answers},
        "answered_at": {},
        "action_status": {},
        "confirmations": {},
        "facts": [],
        "created_at": "2026-10-04T10:12:00+02:00",
        "closed_at": None,
    }
    base.update(extra)
    return IncidentRecord(**base)


def action_ids(org: Organization, answers: dict[str, str]) -> set[str]:
    return {a.id for a in engine.evaluate(record(answers), org, []).actions}


def test_unknown_sent_folder_keeps_both_hypotheses(org: Organization) -> None:
    incident = engine.evaluate(record(FORM), org, [])
    likelihood = {h.id: h.likelihood for h in incident.hypotheses}
    assert likelihood == {"H1": "possible", "H2": "possible"}
    assert {"A9", "A14", "A1", "A2"} <= {a.id for a in incident.actions}
    now = [a for a in incident.actions if a.priority == "now"]
    assert all(a.safe_any_cause for a in now)


def test_not_in_sent_folder_points_to_spoofing(org: Organization) -> None:
    incident = engine.evaluate(record({**FORM, "Q2": "no"}), org, [])
    likelihood = {h.id: h.likelihood for h in incident.hypotheses}
    assert likelihood == {"H1": "unlikely", "H2": "likely"}
    ids = {a.id for a in incident.actions}
    assert not {"A9", "A10", "A11", "A12", "A13"} & ids
    assert {"A13b", "A14", "A15"} <= ids
    spoofing = next(h for h in incident.hypotheses if h.id == "H2")
    assert spoofing.kret_warned is not None


def test_payment_made_adds_bank_call(org: Organization) -> None:
    assert "A7" in action_ids(org, {**FORM, "Q3": "yes"})
    assert "A7" not in action_ids(org, FORM)


def test_data_access_starts_uodo_clock(org: Organization) -> None:
    incident = engine.evaluate(record({**FORM, "Q6": "yes"}, answered_at={"Q6": "2026-10-04T10:30:00+02:00"}), org, [])
    assert {"A16", "A17"} <= {a.id for a in incident.actions}
    assert incident.clocks[0].due_at == "2026-10-07T10:30:00+02:00"


def test_continuity_needs_every_critical_confirmation(org: Organization) -> None:
    critical = [c.id for a in org.activities if a.critical for c in a.confirmations]
    partial = engine.evaluate(record(FORM, confirmations=dict.fromkeys(critical[:-1], True)), org, [])
    assert not partial.continuity.maintained
    assert partial.continuity.missing == 1
    full = engine.evaluate(record(FORM, confirmations=dict.fromkeys(critical, True)), org, [])
    assert full.continuity.maintained
    assert full.continuity.detail == "E-mail biura pozostaje niezaufany."
    statuses = {a.id: a.status for a in full.continuity.activities}
    assert statuses["payments_info"] == "fallback"
    assert statuses["jpk"] == "ok"
    assert statuses["documents"] == "paused"


def test_impact_spreads_from_untrusted_mailbox(org: Organization) -> None:
    impact = engine.build_impact(org)
    assert {s.service for s in impact.threatened} == {
        "accounting_software",
        "client_drive",
        "ksef_sheet",
        "payment_notices",
    }
    assert {s.service for s in impact.fallbacks} == {"phone", "website", "client_phone_list"}


def test_api_flow_rebuilds_plan_and_keeps_log(client: TestClient) -> None:
    created = client.post("/api/incidents", json={"type": "payment_fraud", "answers": FORM, "facts": ["Test."]})
    assert created.status_code == 201
    incident = created.json()
    incident_id = incident["id"]
    assert any(f["source"] == "analiza wiadomości" for f in incident["facts"])

    done = client.patch(f"/api/incidents/{incident_id}/actions/A1", json={"status": "done"})
    assert next(a for a in done.json()["actions"] if a["id"] == "A1")["status"] == "done"

    updated = client.patch(f"/api/incidents/{incident_id}/answers", json={"answers": {"Q2": "no"}}).json()
    assert "A9" not in {a["id"] for a in updated["actions"]}
    assert next(a for a in updated["actions"] if a["id"] == "A1")["status"] == "done"
    kinds = [entry["kind"] for entry in updated["log"]]
    assert kinds[:2] == ["incident_opened", "plan"]
    assert "fact" in kinds and "plan_diff" in kinds

    reloaded = client.get(f"/api/incidents/{incident_id}").json()
    assert reloaded["answers"]["Q2"] == "no"
    assert [e["id"] for e in reloaded["log"]] == [e["id"] for e in updated["log"]]


def test_api_rejects_unavailable_type_and_bad_answer(client: TestClient) -> None:
    assert client.post("/api/incidents", json={"type": "other"}).status_code == 400
    bad = client.post("/api/incidents", json={"type": "payment_fraud", "answers": {"Q2": "maybe"}})
    assert bad.status_code == 400


def test_api_close_and_apply_lessons(client: TestClient) -> None:
    incident_id = client.post("/api/incidents", json={"type": "payment_fraud", "answers": {**FORM, "Q2": "no"}}).json()[
        "id"
    ]
    closed = client.post(f"/api/incidents/{incident_id}/close").json()
    assert closed["status"] == "closed"
    assert [lesson["safeguard"] for lesson in closed["lessons"]][:2] == ["payments_fixed_accounts", "domain_dmarc"]
    assert client.patch(f"/api/incidents/{incident_id}/actions/A1", json={"status": "done"}).status_code == 409

    result = client.post(
        f"/api/incidents/{incident_id}/lessons/apply",
        json={"safeguards": ["payments_fixed_accounts", "domain_dmarc"]},
    ).json()
    assert result["before"]["total"] == 11
    assert result["after"]["total"] == 8
    assert result["applied"] == ["payments_fixed_accounts", "domain_dmarc"]
