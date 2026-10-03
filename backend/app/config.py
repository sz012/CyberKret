import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


@dataclass(frozen=True)
class Settings:
    db_path: Path
    ollama_url: str
    ollama_model: str
    ollama_timeout: float
    cors_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    warmup_llm: bool = True


def load_settings() -> Settings:
    _load_env_file(BACKEND_DIR / ".env")
    db_path = Path(os.environ.get("DB_PATH", "cyberkret.db"))
    if not db_path.is_absolute():
        db_path = BACKEND_DIR / db_path
    return Settings(
        db_path=db_path,
        ollama_url=os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/"),
        ollama_model=os.environ.get("OLLAMA_MODEL", "SpeakLeash/bielik-11b-v3.0-instruct:Q8_0"),
        ollama_timeout=float(os.environ.get("OLLAMA_TIMEOUT", "40")),
    )
