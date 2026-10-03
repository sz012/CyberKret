"""The model explains results computed by the engines. It never decides what is a hole or what to do first."""
from . import ollama

KRET_SYSTEM = """Jesteś cyberKretem. Właśnie sprawdziłeś systemy małej polskiej kancelarii.
Dostajesz wynik silnika: tunele (ścieżki ataku) i trzy ruchy, które je zamykają.
Napisz relację dla szefa kancelarii, który nie zna się na IT. Mów w pierwszej osobie jako kret.
Nie dodawaj nowych dziur ani nowych zaleceń, opisuj tylko to, co dostałeś.
Zwróć JSON: {"headline": "jedno zdanie, max 15 słów", "story": "3-4 krótkie zdania: którędy wszedłbym i co bym zabrał", "first_step": "jedno zdanie zachęty do pierwszego ruchu"}"""

INCIDENT_SYSTEM = """Jesteś cyberKretem. W kancelarii trwa incydent. Dostajesz obraz sytuacji z silnika poradnika.
Napisz odprawę dla szefa kancelarii: spokojnie, konkretnie, bez żargonu, po polsku.
Rozróżniaj to, co potwierdzone, od tego, czego jeszcze nie wiemy. Nie wymyślaj nowych kroków.
Zwróć JSON: {"brief": "3-4 zdania odprawy", "next": "jedno zdanie: najważniejsza rzecz w tej chwili"}"""


def kret_story(run: dict) -> dict:
    tunnels = "\n".join(
        f"- do „{t['target_label']}” ({t['state']}): " + " → ".join(s["name"] for s in t["steps"]) for t in run["tunnels"]
    ) or "- brak tuneli"
    moves = "\n".join(f"- {m['label']} ({m['effort_min']} min), zamyka {len(m['closes'])} tuneli" for m in run["moves"]) or "- brak"
    data, meta = ollama.chat_json(KRET_SYSTEM, f"Tunele:\n{tunnels}\n\nRuchy:\n{moves}")
    if data and data.get("headline"):
        return {"headline": str(data["headline"]), "story": str(data.get("story") or ""),
                "first_step": str(data.get("first_step") or ""), "llm": meta}
    first = run["tunnels"][0]["steps"] if run["tunnels"] else []
    return {
        "headline": run["summary"].split(".")[0] + ".",
        "story": " ".join(s["narration"] for s in first[:3]) if first else "Nie znalazłem drogi do niczego cennego.",
        "first_step": f"Zacznij od: {run['moves'][0]['label'].lower()}." if run["moves"] else "",
        "llm": meta,
    }


def incident_brief(sit: dict) -> dict:
    conf = "\n".join(f"- {f['text']}" for f in sit["confirmed"]) or "- nic"
    unv = "\n".join(f"- {f['text']}" for f in sit["unverified"]) or "- nic"
    hyp = "\n".join(f"- {h['label']}: {h['level']}" for h in sit["hypotheses"].values())
    now = "\n".join(f"- {a['title']} ({a['role_label']})" for a in sit["act_now"])
    data, meta = ollama.chat_json(INCIDENT_SYSTEM, f"Potwierdzone:\n{conf}\n\nNiezweryfikowane:\n{unv}\n\nHipotezy:\n{hyp}\n\nDziałaj teraz:\n{now}")
    if data and data.get("brief"):
        return {"brief": str(data["brief"]), "next": str(data.get("next") or ""), "llm": meta}
    top = max(sit["hypotheses"].values(), key=lambda h: ["unlikely", "possible", "likely"].index(h["level"]))
    return {
        "brief": f"Najbardziej prawdopodobne: {top['label'].lower()}. Potwierdzone fakty: {len(sit['confirmed'])}, "
                 f"do sprawdzenia: {len(sit['unverified'])}. Kroki w kolumnie „Działaj teraz” są bezpieczne bez względu na przyczynę.",
        "next": sit["act_now"][0]["title"] if sit["act_now"] else "",
        "llm": meta,
    }
