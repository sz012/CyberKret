"""Request bodies (API contract). Responses are plain dicts built by the engines; frontend/src/api/types.ts mirrors them."""
from typing import Literal

from pydantic import BaseModel, Field

SafeguardState = Literal["present", "missing", "unknown"]


class SafeguardPatch(BaseModel):
    state: SafeguardState
    source: Literal["kret", "answers", "unverified", "fixed"] = "answers"


class ApplySafeguards(BaseModel):
    safeguards: list[str]


class DomainCheck(BaseModel):
    domain: str = Field(max_length=253)
    consent: bool
    apply: bool = True


class AnalyzeText(BaseModel):
    text: str = Field(min_length=3, max_length=50_000)


class UploadEml(BaseModel):
    eml: str = Field(min_length=10, max_length=2_000_000)


class NewIncident(BaseModel):
    type: str = "fake_invoice"
    mail_id: str | None = None


class Answers(BaseModel):
    answers: dict[str, str]


class ActionStatus(BaseModel):
    status: Literal["todo", "in_progress", "done"]


class Confirmation(BaseModel):
    done: bool
