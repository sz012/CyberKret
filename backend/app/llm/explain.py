"""The model explains results computed by the engines. It never decides what is a hole or what to do first."""
from . import ollama

KRET_SYSTEM = """You are cyberMole. You have just checked the systems of a small company.
You get the engine's result: tunnels (attack paths) and up to three moves that close them.
Write a report for the owner of the company, who knows nothing about IT. Speak in the first person as the mole.
Do not add new holes or new advice, describe only what you were given. Write in English.
Return JSON: {"headline": "one sentence, max 15 words", "story": "3-4 short sentences: how I would get in and what I would take", "first_step": "one sentence encouraging the first move"}"""

INCIDENT_SYSTEM = """You are cyberMole. A small company is in the middle of an incident. You get the situation from the playbook engine.
Write a briefing for the owner of the company: calm, concrete, no jargon, in English.
Keep what is confirmed apart from what we do not know yet. Do not invent new steps.
Return JSON: {"brief": "3-4 sentences of briefing", "next": "one sentence: the most important thing right now"}"""


STORY_SCHEMA = {
    "type": "object",
    "properties": {"headline": {"type": "string"}, "story": {"type": "string"}, "first_step": {"type": "string"}},
    "required": ["headline", "story", "first_step"],
}

BRIEF_SCHEMA = {
    "type": "object",
    "properties": {"brief": {"type": "string"}, "next": {"type": "string"}},
    "required": ["brief", "next"],
}


def kret_story(run: dict) -> dict:
    tunnels = "\n".join(
        f"- to \"{t['target_label']}\" ({t['state']}): " + " → ".join(s["name"] for s in t["steps"]) for t in run["tunnels"]
    ) or "- no tunnels"
    moves = "\n".join(f"- {m['label']} ({m['effort_min']} min), closes {len(m['closes'])} tunnels" for m in run["moves"]) or "- none"
    data, meta = ollama.chat_json(KRET_SYSTEM, f"Tunnels:\n{tunnels}\n\nMoves:\n{moves}\n\nAnswer in English.", STORY_SCHEMA)
    if data and data.get("headline"):
        return {"headline": str(data["headline"]), "story": str(data.get("story") or ""),
                "first_step": str(data.get("first_step") or ""), "llm": meta}
    first = run["tunnels"][0]["steps"] if run["tunnels"] else []
    return {
        "headline": run["summary"].split(".")[0] + ".",
        "story": " ".join(s["narration"] for s in first[:3]) if first else "I found no way to anything valuable.",
        "first_step": f"Start with: {run['moves'][0]['label'][:1].lower() + run['moves'][0]['label'][1:]}." if run["moves"] else "",
        "llm": meta,
    }


def incident_brief(sit: dict) -> dict:
    conf = "\n".join(f"- {f['text']}" for f in sit["confirmed"]) or "- nothing"
    unv = "\n".join(f"- {f['text']}" for f in sit["unverified"]) or "- nothing"
    hyp = "\n".join(f"- {h['label']}: {h['level']}" for h in sit["hypotheses"].values())
    now = "\n".join(f"- {a['title']} ({a['role_label']})" for a in sit["act_now"])
    data, meta = ollama.chat_json(INCIDENT_SYSTEM, f"Confirmed:\n{conf}\n\nUnverified:\n{unv}\n\nHypotheses:\n{hyp}\n\nAct now:\n{now}\n\nAnswer in English.", BRIEF_SCHEMA)
    if data and data.get("brief"):
        return {"brief": str(data["brief"]), "next": str(data.get("next") or ""), "llm": meta}
    top = max(sit["hypotheses"].values(), key=lambda h: ["unlikely", "possible", "likely"].index(h["level"]))
    return {
        "brief": f"Most likely: {top['label'][:1].lower() + top['label'][1:]}. Confirmed facts: {len(sit['confirmed'])}, "
                 f"still to check: {len(sit['unverified'])}. The steps in the \"Act now\" column are safe whatever the cause.",
        "next": sit["act_now"][0]["title"] if sit["act_now"] else "",
        "llm": meta,
    }
