import json
import os
import tempfile

import pytest

os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["LLM_DISABLED"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app import config  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture
def org():
    return json.loads((config.SEED_DIR / "kancelaria_nowak.json").read_text())


@pytest.fixture
def client():
    with TestClient(app) as c:
        c.post("/api/demo/reset")
        yield c


def set_state(org, **states):
    for s in org["safeguards"]:
        if s["id"] in states:
            s["state"] = states[s["id"]]
    return org
