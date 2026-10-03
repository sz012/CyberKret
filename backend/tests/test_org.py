"""Your own firm: a clean template, a saved profile and everything that reads it."""


def test_demo_org_has_help_texts(client):
    org = client.get("/api/org").json()
    assert org["demo"] is True
    assert all(s["help"] for s in org["safeguards"])


def test_new_firm_starts_clean_and_unknown(client):
    org = client.post("/api/org/new", json={"name": "Biuro Testowe"}).json()
    assert org["demo"] is False and org["name"] == "Biuro Testowe"
    assert org["people"] == [] and org["contacts"] == []
    assert {s["state"] for s in org["safeguards"]} == {"unknown"}
    assert client.get("/api/mail").json()["messages"] == []
    assert client.get("/api/incidents").json() == []
    run = client.post("/api/kret/run").json()
    assert run["tunnels"] and all(t["state"] == "possible" for t in run["tunnels"])
    assert {t["target_label"] for t in run["tunnels"]} <= {"Dane klientów", "Pieniądze", "Praca firmy"}


def test_profile_is_saved_and_used_by_incident_and_card(client):
    client.post("/api/org/new", json={"name": "Biuro Testowe"})
    profile = {
        "name": "Biuro Testowe", "domain": "https://www.Biuro-Testowe.pl/", "phone": "600 700 800",
        "description": "", "key_deadline": "Wypłaty w piątek",
        "people": [{"name": "Ewa Lis", "role": "Właścicielka", "duty": "boss"},
                   {"name": "Adam Nowy", "role": "Faktury", "duty": "finance"}],
        "mailbox_owner_index": 1,
        "contacts": [{"name": "Hurtownia Pol", "domain": "pol-hurt.pl", "phone": "+48 22 111 22 33", "note": ""}],
        "fallbacks": [{"label": "Telefon biura", "note": ""}],
    }
    org = client.put("/api/org/profile", json=profile).json()
    assert org["domain"] == "biuro-testowe.pl"
    assert org["mailbox_owner"] == org["people"][1]["id"]
    assert client.get("/api/mail").json()["owner"] == "Adam Nowy"

    inc = client.post("/api/incidents", json={"type": "fake_invoice"}).json()
    roles = {a["id"]: a["role_label"] for a in inc["situation"]["plan"]}
    assert roles["hold_payments"] == "Adam (księgowość)"
    assert inc["situation"]["continuity"]["items"][0]["label"] == "Wypłaty w piątek"
    priority = next(q for q in inc["situation"]["questions"] if q["id"] == "priority")
    assert priority["options"][0]["label"] == "Wypłaty w piątek"
    sms = next(m for m in inc["situation"]["messages"] if m["id"] == "sms_clients")["text"]
    assert sms.startswith("Biuro Testowe:") and "600 700 800" in sms

    card = client.get("/api/org/card").json()
    assert card["org"] == "Biuro Testowe" and card["contacts"][0]["phone"] == "+48 22 111 22 33"


def test_invalid_domain_is_rejected_in_polish(client):
    r = client.put("/api/org/profile", json={"name": "X", "domain": "to nie domena", "people": [], "contacts": [], "fallbacks": []})
    assert r.status_code == 422 and "nie wygląda na domenę" in r.json()["detail"]


def test_demo_mail_only_in_demo(client):
    assert client.post("/api/mail/deliver-next").status_code == 200
    client.post("/api/org/new", json={"name": "Biuro Testowe"})
    assert client.post("/api/mail/deliver-next").status_code == 409
