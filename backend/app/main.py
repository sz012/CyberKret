import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, load_settings
from .db import Store
from .llm.ollama import OllamaClient
from .routers import analyze, incidents, kret, org, system
from .seed import load_seed


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    store = Store(settings.db_path)
    store.init(load_seed())
    llm = OllamaClient(settings.ollama_url, settings.ollama_model, settings.ollama_timeout)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.warmup_llm:
            threading.Thread(target=llm.warmup, daemon=True).start()
        yield

    app = FastAPI(title="CyberKret API", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.store = store
    app.state.llm = llm
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Content-Type"],
    )
    for module in (system, org, kret, incidents, analyze):
        app.include_router(module.router)
    return app
