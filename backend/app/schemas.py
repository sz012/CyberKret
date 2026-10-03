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


class Person(BaseModel):
    id: str | None = Field(default=None, max_length=40)
    name: str = Field(min_length=1, max_length=80)
    role: str = Field(default="", max_length=80)
    duty: Literal["boss", "finance", "office", "it", "other"] = "other"


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    domain: str = Field(default="", max_length=253)
    phone: str = Field(default="", max_length=40)
    note: str = Field(default="", max_length=200)


class Fallback(BaseModel):
    label: str = Field(min_length=1, max_length=60)
    note: str = Field(default="", max_length=200)


class OrgProfile(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    domain: str = Field(default="", max_length=253)
    phone: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=300)
    key_deadline: str = Field(default="", max_length=120)
    people: list[Person] = Field(default_factory=list, max_length=50)
    mailbox_owner_index: int | None = None
    contacts: list[Contact] = Field(default_factory=list, max_length=100)
    fallbacks: list[Fallback] = Field(default_factory=list, max_length=20)


class NewOrg(BaseModel):
    name: str = Field(min_length=1, max_length=80)
