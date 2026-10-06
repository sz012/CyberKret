"""Minimal Ollama client. Everything stays on localhost; on any failure callers fall back to templates."""
import json
import logging
import time

import httpx

from .. import config

log = logging.getLogger("cybermole.llm")
_resolved_model: str | None = None
PREFERRED = ("bielik", "qwen", "gemma")


def list_models() -> list[str]:
    try:
        r = httpx.get(f"{config.OLLAMA_URL}/api/tags", timeout=2.0)
        r.raise_for_status()
        return [m["name"] for m in r.json().get("models", [])]
    except (httpx.HTTPError, ValueError, KeyError):
        return []


def model() -> str | None:
    """Configured model if it is pulled; otherwise the first local Bielik, Qwen or Gemma; otherwise any model."""
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
    preferred = [m for family in PREFERRED for m in models if family in m.lower()]
    _resolved_model = (exact or preferred or models)[0]
    return _resolved_model


def options() -> dict:
    return {"temperature": 0.1, "num_ctx": config.OLLAMA_CTX, "num_predict": 800}


def chat_json(system: str, user: str, schema: dict | None = None, timeout: float | None = None) -> tuple[dict | None, dict]:
    """Ask for a JSON object, constrained by `schema` when given. Returns (parsed or None, meta)."""
    m = model()
    meta = {"model": m, "local": True, "ms": None, "error": None}
    if not m:
        meta["error"] = "no local model"
        return None, meta
    if schema:
        system = f"{system}\n\nAnswer schema (JSON Schema):\n{json.dumps(schema, ensure_ascii=False)}"
    body = {
        "model": m,
        "stream": False,
        "format": schema or "json",
        "think": False,
        "keep_alive": "30m",
        "options": options(),
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
        httpx.post(f"{config.OLLAMA_URL}/api/generate",
                   json={"model": m, "prompt": "", "keep_alive": "30m", "options": options()}, timeout=180)
    except httpx.HTTPError:
        pass
