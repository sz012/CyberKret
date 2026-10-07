def new_incident(client):
    client.post("/api/mail/deliver-next")
    client.post("/api/mail/01_biurex_phishing/scan")
    return client.post("/api/incidents", json={"type": "fake_invoice", "mail_id": "01_biurex_phishing"}).json()


def ids(inc):
    return {a["id"] for a in inc["situation"]["plan"]}


def test_unknown_sent_keeps_both_hypotheses_and_safe_steps_first(client):
    inc = new_incident(client)
    inc = client.patch(f"/api/incidents/{inc['id']}/answers", json={"answers": {"sent": "unknown", "paid": "unknown"}}).json()
    h = inc["situation"]["hypotheses"]
    assert h["takeover"]["level"] == "possible" and h["spoof"]["level"] == "likely"
    assert {"reset_password", "report_cert", "check_payments"} <= ids(inc)
    assert inc["situation"]["act_now"][0]["safe_any_cause"]
    assert len(inc["situation"]["confirmed"]) >= 5  # facts from the mail scan


def test_new_fact_rebuilds_plan_and_keeps_statuses(client):
    inc = new_incident(client)
    iid = inc["id"]
    client.patch(f"/api/incidents/{iid}/answers", json={"answers": {"sent": "unknown"}})
    client.patch(f"/api/incidents/{iid}/actions/signout", json={"status": "done"})
    client.patch(f"/api/incidents/{iid}/actions/hold_payments", json={"status": "done"})
    inc = client.patch(f"/api/incidents/{iid}/answers", json={"answers": {"sent": "no", "clicked": "no"}}).json()
    assert inc["situation"]["hypotheses"]["takeover"]["level"] == "unlikely"
    assert "signout" not in ids(inc)
    assert next(a for a in inc["situation"]["plan"] if a["id"] == "hold_payments")["status"] == "done"
    log = " ".join(e["message"] for e in inc["events"])
    assert "Plan rebuilt" in log and "Steps done earlier stay in the log" in log


def test_paid_adds_bank_recall(client):
    inc = new_incident(client)
    inc = client.patch(f"/api/incidents/{inc['id']}/answers", json={"answers": {"paid": "yes"}}).json()
    assert {"bank_recall", "police"} <= ids(inc)
    assert "check_payments" not in ids(inc)


def test_continuity_banner_only_after_confirmations(client):
    inc = new_incident(client)
    iid = inc["id"]
    inc = client.patch(f"/api/incidents/{iid}/answers", json={"answers": {"priority": "court"}}).json()
    for a in inc["situation"]["plan"]:
        client.patch(f"/api/incidents/{iid}/actions/{a['id']}", json={"status": "done"})
    inc = client.get(f"/api/incidents/{iid}").json()
    assert not inc["situation"]["continuity"]["maintained"]
    for cid in ("court_doc", "court_folder", "court_sub", "pay_hold", "pay_bank"):
        inc = client.patch(f"/api/incidents/{iid}/confirmations/{cid}", json={"done": True}).json()
    assert inc["situation"]["continuity"]["maintained"]


def test_uodo_clock_when_client_data_exposed(client):
    inc = new_incident(client)
    inc = client.patch(f"/api/incidents/{inc['id']}/answers", json={"answers": {"clients": "yes"}}).json()
    assert inc["situation"]["uodo"]["deadline"]
    assert "uodo" in ids(inc)


def test_close_and_fill_tunnels(client):
    before = client.post("/api/kret/run").json()
    inc = new_incident(client)
    client.post(f"/api/incidents/{inc['id']}/close")
    client.post("/api/kret/apply", json={"safeguards": ["payment_callback_rule", "domain_dmarc", "m365_mfa"]})
    after = client.post("/api/kret/run", params={"label": "after filling in"}).json()
    assert len(after["tunnels"]) < len(before["tunnels"])
    assert "money_stolen" not in {t["target"] for t in after["tunnels"]}


def test_state_survives_reload(client):
    inc = new_incident(client)
    client.patch(f"/api/incidents/{inc['id']}/actions/hold_payments", json={"status": "done"})
    again = client.get(f"/api/incidents/{inc['id']}").json()
    assert again["action_status"]["hold_payments"] == "done"


def test_demo_domain_uses_fixture(client):
    r = client.post("/api/kret/domain-check", json={"domain": "nowak-law.example", "consent": True}).json()
    assert r["demo"] and "domain_dmarc" in r["applied"]


def test_domain_check_requires_consent_and_valid_name(client):
    assert client.post("/api/kret/domain-check", json={"domain": "x.example", "consent": False}).status_code == 400
    assert client.post("/api/kret/domain-check", json={"domain": "127.0.0.1", "consent": True}).status_code == 422


def test_phases_follow_plan_continuity_and_lessons(client):
    inc = new_incident(client)
    iid = inc["id"]
    phases = {p["id"]: p for p in inc["situation"]["phases"]}
    assert [p["label"] for p in inc["situation"]["phases"]] == ["Stop", "Assess", "Notify", "Keep running", "Learn"]
    assert phases["stop"]["done"] == 0 and phases["stop"]["total"] >= 1
    client.patch(f"/api/incidents/{iid}/actions/hold_payments", json={"status": "done"})
    inc = client.patch(f"/api/incidents/{iid}/confirmations/court_doc", json={"done": True}).json()
    phases = {p["id"]: p for p in inc["situation"]["phases"]}
    assert phases["stop"]["done"] == 1
    assert phases["continue"]["done"] == 1
    assert phases["learn"] == {"id": "learn", "label": "Learn", "done": 0, "total": 3}


def test_emergency_card_lists_safe_first_steps_and_channels(client):
    card = client.get("/api/org/card").json()
    assert card["org"] == "Nowak Law Office"
    assert card["first_steps"][0]["title"] == "Stop payments to new account numbers"
    assert all(step["role"] for step in card["first_steps"])
    assert {f["label"] for f in card["fallbacks"]} >= {"Office phone", "Offline copy of the files"}
    assert all(c["phone"] for c in card["contacts"])
    assert any("UODO" in rule for rule in card["rules"])
