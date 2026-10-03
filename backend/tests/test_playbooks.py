"""All five playbooks: safe first steps, plans that react to facts, the UODO rule and the drawer card."""
import pytest

TYPES = ["fake_invoice", "ransomware", "lost_laptop", "account_takeover", "outage"]


def start(client, type_):
    return client.post("/api/incidents", json={"type": type_}).json()


def answer(client, inc, **answers):
    return client.patch(f"/api/incidents/{inc['id']}/answers", json={"answers": answers}).json()


def ids(inc):
    return {a["id"] for a in inc["situation"]["plan"]}


def test_all_types_are_ready(client):
    types = client.get("/api/incidents/types").json()
    assert [t["id"] for t in types] == TYPES and all(t["ready"] for t in types)


@pytest.mark.parametrize("type_", TYPES)
def test_every_answer_has_a_fact_and_a_plan(client, type_):
    inc = start(client, type_)
    s = inc["situation"]
    assert s["act_now"] and s["map"]["note"] and all(a["role_label"] for a in s["plan"])
    assert len(s["unverified"]) == len([q for q in s["questions"] if q["id"] != "priority"])
    for q in s["questions"]:
        for o in q["options"]:
            inc = answer(client, inc, **{q["id"]: o["value"]})
            assert inc["situation"]["plan"]


def test_ransomware_on_many_machines_points_to_the_network(client):
    inc = answer(client, start(client, "ransomware"), spread="many", backup="yes")
    h = inc["situation"]["hypotheses"]
    assert h["network"]["level"] == "likely" and h["single"]["level"] == "unlikely"
    assert {"close_remote", "reset_admin", "check_backup", "restore", "warn_clients"} <= ids(inc)
    assert "no_backup" not in ids(inc)


def test_ransomware_without_backup_and_with_client_data(client):
    inc = answer(client, start(client, "ransomware"), backup="no", data="yes")
    assert {"no_backup", "uodo"} <= ids(inc) and "restore" not in ids(inc)
    assert inc["situation"]["uodo"]["deadline"]


def test_lost_laptop_encrypted_and_locked_is_safe(client):
    inc = answer(client, start(client, "lost_laptop"), encrypted="yes", unlocked="no", how="lost", data="yes")
    assert inc["situation"]["hypotheses"]["exposed"]["level"] == "unlikely"
    assert not {"remote_wipe", "uodo", "police"} & ids(inc)
    assert inc["situation"]["uodo"] is None


def test_lost_laptop_unencrypted_with_client_data(client):
    inc = answer(client, start(client, "lost_laptop"), encrypted="no", how="stolen", data="yes")
    assert {"remote_wipe", "uodo", "inform_clients", "police"} <= ids(inc)
    assert inc["situation"]["uodo"]["deadline"]


def test_account_takeover_without_access_and_with_reused_password(client):
    inc = answer(client, start(client, "account_takeover"), access="no", reused="yes", sent="yes")
    assert {"recover", "other_accounts", "check_payments", "warn_contacts"} <= ids(inc)
    assert "reset_password" not in ids(inc)
    assert inc["situation"]["hypotheses"]["leak"]["level"] == "likely"


def test_outage_on_one_computer_is_local(client):
    inc = answer(client, start(client, "outage"), what="internet", scope="one", signs="no")
    s = inc["situation"]
    assert s["hypotheses"]["local"]["level"] == "likely" and s["hypotheses"]["attack"]["level"] == "unlikely"
    assert {"fix_one", "restart_router"} <= ids(inc) and "attack_check" not in ids(inc)
    assert s["map"]["untrusted"] == ["siec"] and s["uodo"] is None


def test_outage_with_attack_signs_points_to_other_playbooks(client):
    inc = answer(client, start(client, "outage"), signs="yes")
    assert "attack_check" in ids(inc) and "hotspot" not in ids(inc)


def test_card_has_first_steps_for_every_type(client):
    card = client.get("/api/org/card").json()
    assert [b["id"] for b in card["by_type"]] == TYPES
    assert all(1 <= len(b["steps"]) <= 3 for b in card["by_type"])
