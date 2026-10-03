from fastapi import APIRouter

from ..deps import LlmDep, StoreDep
from ..llm.message_check import analyze_message
from ..schemas import MessageCheckRequest, MessageCheckResult

router = APIRouter(prefix="/api", tags=["analyze"])

VERDICT_LABELS = {"suspicious": "podejrzana", "unclear": "do sprawdzenia", "likely_safe": "bez typowych sygnałów"}


@router.post("/analyze-message", response_model=MessageCheckResult)
def analyze(body: MessageCheckRequest, store: StoreDep, llm: LlmDep) -> MessageCheckResult:
    result = analyze_message(body.text, store.get_org(), llm)
    source = "model lokalny" if result.mode == "model" else "reguły"
    store.log("message_check", f"Kret pocztowy sprawdził wiadomość: {VERDICT_LABELS[result.verdict]} ({source}).")
    return result
