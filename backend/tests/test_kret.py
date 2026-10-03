from app.kret import engine

from .conftest import set_state


def test_seed_reaches_all_three_targets(org):
    run = engine.run(org)
    assert {t["target"] for t in run["tunnels"]} == {"client_data_read", "money_stolen", "operations_stopped"}
    assert run["counts"]["open"] == 5


def test_first_move_closes_rdp_then_mfa_then_callback(org):
    moves = engine.run(org)["moves"]
    assert [m["safeguard"] for m in moves] == ["router_no_rdp", "m365_mfa", "payment_callback_rule"]
    assert engine.run(org)["counts"]["after_moves"] == 0


def test_closing_rdp_closes_paths_through_admin(org):
    run = engine.run(set_state(org, router_no_rdp="present"))
    assert all("T1" not in [s["technique"] for s in t["steps"]] for t in run["tunnels"])
    assert "operations_stopped" not in {t["target"] for t in run["tunnels"]}


def test_dmarc_and_callback_rule_protect_money(org):
    run = engine.run(set_state(org, domain_dmarc="present", payment_callback_rule="present"))
    assert "money_stolen" not in {t["target"] for t in run["tunnels"]}


def test_unknown_is_a_possible_tunnel(org):
    run = engine.run(set_state(org, m365_mfa="unknown"))
    states = {t["id"]: t["state"] for t in run["tunnels"]}
    assert states["tunnel-T3-T5"] == "possible"


def test_missing_safeguard_alone_is_amber_on_an_open_path_red(org):
    ch = {c["chamber"]: c["status"] for c in engine.run(org)["chambers"]}
    assert ch["siec"] == "bad" and ch["www"] == "ok"
    assert ch["kopie"] == "bad"
    fixed = {c["chamber"]: c["status"] for c in engine.run(set_state(org, router_no_rdp="present"))["chambers"]}
    # Backup still missing, but no open path reaches it any more: amber, not red.
    assert fixed["kopie"] == "warn"


def test_everything_present_means_no_tunnels(org):
    for s in org["safeguards"]:
        s["state"] = "present"
    run = engine.run(org)
    assert run["tunnels"] == [] and run["moves"] == []
