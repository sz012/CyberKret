from typing import Literal

from pydantic import BaseModel, Field

SafeguardState = Literal["present", "missing", "unknown"]
SafeguardSource = Literal["kret", "answers"]
PathStatus = Literal["open", "possible"]
SegmentStatus = Literal["open", "possible", "closed"]
Priority = Literal["now", "15min", "30min", "verify"]
Phase = Literal["stop", "assess", "notify", "continue", "learn"]
ActionStatus = Literal["todo", "in_progress", "done"]
Likelihood = Literal["likely", "possible", "unlikely"]
ActivityStatus = Literal["ok", "fallback", "at_risk", "paused", "pending"]
Verdict = Literal["suspicious", "likely_safe", "unclear"]
FindingStatus = Literal["ok", "warn", "bad", "info", "unknown"]


class Service(BaseModel):
    id: str
    name: str
    description: str
    layer: Literal["surface", "fallback"]
    icon: str


class Dependency(BaseModel):
    source: str
    target: str
    label: str
    kind: Literal["depends", "fallback"]


class Safeguard(BaseModel):
    id: str
    service: str
    label: str
    fix: str
    why: str
    state: SafeguardState
    source: SafeguardSource
    effort_minutes: int = Field(ge=1)


class Person(BaseModel):
    id: str
    name: str
    role: str


class Channel(BaseModel):
    id: str
    name: str
    description: str
    service: str | None = None


class MessageTemplate(BaseModel):
    id: str
    title: str
    text: str


class Confirmation(BaseModel):
    id: str
    label: str


class Activity(BaseModel):
    id: str
    name: str
    note: str
    critical: bool
    depends_on: list[str]
    normally: str
    fallback: str | None = None
    confirmations: list[Confirmation]


class DomainFinding(BaseModel):
    id: str
    label: str
    status: FindingStatus
    detail: str


class DomainCheck(BaseModel):
    domain: str
    checked_at: str
    demo: bool
    mail_provider: str | None = None
    findings: list[DomainFinding]


class Organization(BaseModel):
    id: str
    name: str
    domain: str
    mailbox: str
    description: str
    today_note: str
    continuity_ok: str
    sample_message: str
    services: list[Service]
    dependencies: list[Dependency]
    safeguards: list[Safeguard]
    people: list[Person]
    channels: list[Channel]
    templates: list[MessageTemplate]
    activities: list[Activity]
    domain_check: DomainCheck | None = None


class SafeguardUpdate(BaseModel):
    state: SafeguardState
    source: SafeguardSource = "answers"


class KretPosition(BaseModel):
    id: str
    label: str
    kind: Literal["entry", "foothold", "target"]
    description: str


class KretStep(BaseModel):
    technique: str
    name: str
    source: str
    target: str
    narrative: str
    requires: list[str]
    unknown: list[str]


class KretPath(BaseModel):
    id: str
    target: str
    status: PathStatus
    steps: list[KretStep]


class KretMove(BaseModel):
    safeguard: str
    fix: str
    why: str
    closes: int
    effort_minutes: int
    paths: list[str]


class KretTarget(BaseModel):
    id: str
    label: str
    description: str
    open: int
    possible: int


class SafeguardRef(BaseModel):
    id: str
    label: str
    source: SafeguardSource


class KretStory(BaseModel):
    target: str
    title: str
    path: str
    lines: list[str]


class KretSegment(BaseModel):
    source: str
    target: str
    status: SegmentStatus
    techniques: list[str]
    names: list[str]


class KretResult(BaseModel):
    id: int | None = None
    created_at: str
    total: int
    possible: int
    remaining_after_moves: int
    moves_minutes: int
    paths: list[KretPath]
    moves: list[KretMove]
    targets: list[KretTarget]
    good: list[SafeguardRef]
    unknown: list[SafeguardRef]
    intro: str
    outro: str
    stories: list[KretStory]
    positions: list[KretPosition]
    segments: list[KretSegment]


class KretRunSummary(BaseModel):
    id: int
    created_at: str
    total: int
    remaining_after_moves: int


class DomainCheckRequest(BaseModel):
    domain: str = Field(min_length=3, max_length=253)
    consent: bool


class DomainCheckResponse(BaseModel):
    check: DomainCheck
    applied: bool


class QuestionOption(BaseModel):
    value: str
    label: str


class Question(BaseModel):
    id: str
    text: str
    short: str
    help: str
    options: list[QuestionOption]
    in_form: bool


class IncidentType(BaseModel):
    id: str
    label: str
    description: str
    available: bool


class IncidentCatalog(BaseModel):
    types: list[IncidentType]
    questions: list[Question]
    defaults: dict[str, str]


class Fact(BaseModel):
    id: str
    text: str
    state: Literal["confirmed", "unverified"]
    source: str
    question: str | None = None


class Hypothesis(BaseModel):
    id: str
    label: str
    likelihood: Likelihood
    reason: str
    kret_warned: str | None = None


class Action(BaseModel):
    id: str
    title: str
    detail: str
    priority: Priority
    phase: Phase
    role: str
    safe_any_cause: bool
    tag: str | None = None
    template: str | None = None
    status: ActionStatus


class PhaseProgress(BaseModel):
    id: Phase
    label: str
    done: int
    total: int


class ImpactService(BaseModel):
    service: str
    name: str
    reason: str


class Impact(BaseModel):
    untrusted: list[ImpactService]
    threatened: list[ImpactService]
    unsafe: list[str]
    fallbacks: list[ImpactService]


class ConfirmationState(BaseModel):
    id: str
    label: str
    done: bool


class ActivityState(BaseModel):
    id: str
    name: str
    note: str
    critical: bool
    status: ActivityStatus
    normally: str
    fallback: str | None
    confirmations: list[ConfirmationState]


class Continuity(BaseModel):
    maintained: bool
    headline: str
    detail: str
    missing: int
    activities: list[ActivityState]


class Clock(BaseModel):
    id: str
    label: str
    started_at: str
    due_at: str


class Lesson(BaseModel):
    safeguard: str
    fix: str
    why: str
    reason: str
    state: SafeguardState


class LogEntry(BaseModel):
    id: int
    incident_id: int | None
    created_at: str
    kind: str
    message: str


class IncidentSummary(BaseModel):
    id: int
    type: str
    type_label: str
    status: Literal["open", "closed"]
    created_at: str
    closed_at: str | None
    done: int
    total: int


class Incident(BaseModel):
    id: int
    type: str
    type_label: str
    status: Literal["open", "closed"]
    created_at: str
    closed_at: str | None
    answers: dict[str, str]
    questions: list[Question]
    facts: list[Fact]
    hypotheses: list[Hypothesis]
    actions: list[Action]
    phases: list[PhaseProgress]
    impact: Impact
    continuity: Continuity
    clocks: list[Clock]
    lessons: list[Lesson]
    log: list[LogEntry]


class IncidentCreate(BaseModel):
    type: str = Field(max_length=40)
    answers: dict[str, str] = Field(default_factory=dict)
    facts: list[str] = Field(default_factory=list, max_length=20)


class AnswersUpdate(BaseModel):
    answers: dict[str, str] = Field(min_length=1)


class ActionStatusUpdate(BaseModel):
    status: ActionStatus


class ConfirmationUpdate(BaseModel):
    done: bool


class LessonsApply(BaseModel):
    safeguards: list[str] = Field(min_length=1, max_length=20)


class LessonsResult(BaseModel):
    applied: list[str]
    before: KretResult
    after: KretResult


class MessageCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class Indicator(BaseModel):
    type: str
    label: str
    quote: str
    explanation: str
    source: Literal["rules", "model"]
    start: int
    end: int


class MessageCheckResult(BaseModel):
    verdict: Verdict
    summary: str
    advice: str
    indicators: list[Indicator]
    facts: list[str]
    mode: Literal["model", "rules"]
    model: str | None
    note: str | None


class LlmStatus(BaseModel):
    available: bool
    model: str


class Health(BaseModel):
    status: str
    llm: LlmStatus
