import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
SEED_DIR = APP_DIR / "seed"
ROOT_DIR = APP_DIR.parent.parent


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(ROOT_DIR / ".env.local")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "hf.co/second-state/Bielik-4.5B-v3.0-Instruct-GGUF:Q4_K_M")
OLLAMA_CTX = int(os.getenv("OLLAMA_CTX", "4096"))
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))
LLM_DISABLED = os.getenv("LLM_DISABLED", "0") == "1"
DB_PATH = os.getenv("DB_PATH", str(APP_DIR.parent / "cyberkret.db"))

IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", "")
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", "")
IMAP_FOLDER = os.getenv("IMAP_FOLDER", "INBOX")
IMAP_DAYS = int(os.getenv("IMAP_DAYS", "14"))
IMAP_LIMIT = int(os.getenv("IMAP_LIMIT", "30"))
