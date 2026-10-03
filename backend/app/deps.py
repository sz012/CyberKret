from typing import Annotated

from fastapi import Depends, Request

from .db import Store
from .llm.ollama import OllamaClient


def get_store(request: Request) -> Store:
    return request.app.state.store


def get_llm(request: Request) -> OllamaClient:
    return request.app.state.llm


StoreDep = Annotated[Store, Depends(get_store)]
LlmDep = Annotated[OllamaClient, Depends(get_llm)]
