from app.kret.engine import run_kret
from app.schemas import Organization


def set_state(org: Organization, safeguard_id: str, state: str) -> None:
    next(s for s in org.safeguards if s.id == safeguard_id).state = state


def test_seed_has_eleven_paths_to_four_targets(org: Organization) -> None:
    result = run_kret(org)
    counts = {t.id: (t.open, t.possible) for t in result.targets}
    assert result.total == 11
    assert counts == {
        "client_data_read": (3, 0),
        "ksef_access": (3, 0),
        "clients_pay_attacker": (3, 0),
        "deadlines_missed": (0, 2),
    }


def test_moves_close_most_paths_first(org: Organization) -> None:
    result = run_kret(org)
    assert [(m.safeguard, m.closes) for m in result.moves] == [
        ("email_mfa", 8),
        ("client_folder_private", 2),
        ("payments_fixed_accounts", 1),
    ]
    assert result.remaining_after_moves == 0
    assert result.moves_minutes == 60


def test_unknown_safeguard_makes_path_possible(org: Organization) -> None:
    result = run_kret(org)
    deadline_paths = [p for p in result.paths if p.target == "deadlines_missed"]
    assert deadline_paths
    assert all(p.status == "possible" for p in deadline_paths)
    assert all("software_admin_mfa" in p.steps[1].unknown for p in deadline_paths)


def test_mfa_removes_eight_paths(org: Organization) -> None:
    set_state(org, "email_mfa", "present")
    assert run_kret(org).total == 3


def test_three_moves_leave_no_paths(org: Organization) -> None:
    for safeguard_id in ("email_mfa", "client_folder_private", "payments_fixed_accounts"):
        set_state(org, safeguard_id, "present")
    result = run_kret(org)
    assert result.total == 0
    assert all(segment.status == "closed" for segment in result.segments)
    assert "nie znalazłem żadnej drogi" in result.intro


def test_stale_recovery_number_opens_new_door(org: Organization) -> None:
    set_state(org, "email_mfa", "present")
    set_state(org, "email_recovery_current", "missing")
    paths = run_kret(org).paths
    assert any(p.steps[0].technique == "T3" for p in paths)


def test_story_mentions_uncertain_safeguard(org: Organization) -> None:
    story = next(s for s in run_kret(org).stories if s.target == "deadlines_missed")
    assert story.title == "Terminy klientów: 2 drogi"
    assert story.lines[-1].startswith("Tej drogi nie jestem pewien.")
