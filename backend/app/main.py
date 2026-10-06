import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, db
from .llm import ollama
from .routers import demo, incidents, kret, mail, org

logging.basicConfig(level=logging.INFO)



@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init()
    threading.Thread(target=ollama.warm_up, daemon=True).start()
    yield


app = FastAPI(title="cyberMole", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (org.router, kret.router, mail.router, incidents.router, demo.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    models = ollama.list_models()
    m = ollama.model() if models else None
    return {
        "ok": True,
        "llm": {"available": bool(m), "model": m, "configured": config.OLLAMA_MODEL, "url": config.OLLAMA_URL,
                "models": models, "mode": "lokalny model" if m else "tryb bez modelu"},
        "external_bytes": 0,
    }
