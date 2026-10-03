import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
SEED_DIR = APP_DIR / "seed"

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
# Exact tag depends on what was pulled; if it is missing, the client falls back to the first local "qwen" model.
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.6")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "60"))
LLM_DISABLED = os.getenv("LLM_DISABLED", "0") == "1"
DB_PATH = os.getenv("DB_PATH", str(APP_DIR.parent / "cyberkret.db"))
