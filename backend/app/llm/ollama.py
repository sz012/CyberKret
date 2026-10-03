"""Minimal Ollama client. Everything stays on localhost; on any failure callers fall back to templates."""
import json
import logging
import time

import httpx

from .. import config

log = logging.getLogger("cyberkret.llm")
_resolved_model: str | None = None


def list_models() -> list[str]:
    try:
        r = httpx.get(f"{config.OLLAMA_URL}/api/tags", timeout=2.0)
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])]
    except (httpx.HTTPError, ValueError, KeyError):
        return []


def model() -> str | None:
    """Configured model if it is pulled; otherwise the first local qwen model; otherwise None."""
    global _resolved_model
    if config.LLM_DISABLED:
        return None
    models = list_models()
    if not models:
        return None
    if _resolved_model in models:
        return _resolved_model
    want = config.OLLAMA_MODEL
    exact = [m for m in models if m == want or m == f"{want}:latest" or m.startswith(f"{want}:")]
    qwen = [m for m in models if "qwen" in m.lower()]
    _resolved_model = (exact or qwen or models)[0]
    return _resolved_model


def chat_json(system: str, user: str, timeout: float | None = None) -> tuple[dict | None, dict]:
    """Ask for a JSON object. Returns (parsed or None, meta) where meta says which model answered and how fast."""
    m = model()
    meta = {"model": m, "local": True, "ms": None, "error": None}
    if not m:
        meta["error"] = "brak lokalnego modelu"
        return None, meta
    body = {
        "model": m,
        "stream": False,
        "format": "json",
        "think": False,
        "keep_alive": "30m",
        "options": {"temperature": 0.2},
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
    }
    t0 = time.monotonic()
    try:
        r = httpx.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=timeout or config.LLM_TIMEOUT)
        if r.status_code == 400 and "think" in r.text:
            body.pop("think")
            r = httpx.post(f"{config.OLLAMA_URL}/api/chat", json=body, timeout=timeout or config.LLM_TIMEOUT)
        r.raise_for_status()
        content = r.json()["message"]["content"]
        meta["ms"] = int((time.monotonic() - t0) * 1000)
        data = json.loads(content)
        return (data if isinstance(data, dict) else None), meta
    except (httpx.HTTPError, ValueError, KeyError) as e:
        log.warning("LLM call failed: %s", e)
        meta["error"] = type(e).__name__
        meta["ms"] = int((time.monotonic() - t0) * 1000)
        return None, meta


def warm_up() -> None:
    m = model()
    if not m:
        return
    try:
        httpx.post(f"{config.OLLAMA_URL}/api/generate", json={"model": m, "prompt": "", "keep_alive": "30m"}, timeout=120)
    except httpx.HTTPError:
        pass
