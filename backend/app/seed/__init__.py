from pathlib import Path

from ..db import now_iso
from ..schemas import DomainCheck, Organization

SEED_DIR = Path(__file__).resolve().parent


def load_seed() -> Organization:
    return Organization.model_validate_json((SEED_DIR / "saldo.json").read_text(encoding="utf-8"))


def load_domain_fixture() -> DomainCheck:
    fixture = DomainCheck.model_validate_json((SEED_DIR / "domain_fixture.json").read_text(encoding="utf-8"))
    return fixture.model_copy(update={"checked_at": now_iso()})
