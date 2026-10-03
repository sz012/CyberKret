import json
from contextlib import suppress
from typing import Any

import httpx


class OllamaClient:
    def __init__(self, base_url: str, model: str, timeout: float) -> None:
        self.base_url = base_url
        self.model = model
        self.timeout = timeout

    def available(self) -> bool:
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=1.5)
            response.raise_for_status()
            models = response.json().get("models", [])
        except (httpx.HTTPError, ValueError):
            return False
        wanted = self.model.lower()
        names = {str(m.get("name", "")).lower() for m in models}
        return wanted in names or f"{wanted}:latest" in names

    def chat_json(self, system: str, user: str, schema: dict[str, Any]) -> dict[str, Any] | None:
        payload = {
            "model": self.model,
            "stream": False,
            "format": schema,
            "keep_alive": "30m",
            "options": {"temperature": 0},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        try:
            response = httpx.post(f"{self.base_url}/api/chat", json=payload, timeout=self.timeout)
            response.raise_for_status()
            data = json.loads(response.json()["message"]["content"])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            return None
        return data if isinstance(data, dict) else None

    def warmup(self) -> None:
        with suppress(httpx.HTTPError):
            httpx.post(
                f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": "", "keep_alive": "30m"},
                timeout=self.timeout,
            )
