# CyberKret

> Lepiej, żeby pierwszy był Twój kret. (Better that the first mole in your systems is yours.)

CyberKret is a mole that a small organization lets into its own systems before a real attacker gets there. It shows the paths an attacker would take ("tunnels"), what to close first, and when something does happen, it walks the team through the incident so the most important work keeps going.

Built for HackYeah 2026, task **Defence**. Target users: law firms, accounting offices, tax advisors, clinics, NGOs: 3–50 people, sensitive client data, no IT department.

Everything runs on one machine in the office. The language model is local (Qwen via Ollama), so client emails and scan results never leave the building: **0 bytes sent out**.

## Three features

| | What it does | What is real |
|---|---|---|
| **Tunele** (tunnels) | The mole rides network cables under the office floor to each area it checks (network, computers, accounts, mail and domain, payments, backups, website). Then it chains weaknesses into attack paths from the internet to client files, money, or a stopped business, and picks the 3 moves that close the most. | Attack-graph engine + greedy "fill first", passive domain check (MX, SPF, DMARC, DKIM, HTTPS, headers), read-only local agent (firewall, FileVault, Gatekeeper, SIP, updates on macOS). The organization map is a fictional seed. |
| **Kret pocztowy** (mail mole) | Reads every new email in Ms. Grażyna's inbox before she does. Opens attachments as text in its own "burrow", never executes them. Explains in plain Polish what to do. | `.eml` parsing: lookalike sender domains, Reply-To mismatch, Authentication-Results, link text vs. target, double extensions, fake PDFs, password forms inside attachments, account-change and urgency phrases. The local model only explains; it may raise the alarm, never lower it, and its quotes must exist in the message. |
| **Incydent** (incident mode) | Five questions, then a plan: confirmed vs. unverified facts, two hypotheses (spoofing vs. mailbox takeover), "act now" steps that are safe whatever the cause, roles, continuity checks, ready-to-send messages, a 72 h GDPR (UODO) clock, and a log. The plan rebuilds after every new fact. Closing the incident proposes which tunnels to fill; the mole digs again and shows before/after. | Rules-based playbook engine with plan diffing and persistence in SQLite. |

Rule that ties it together: **the mole always says how it knows** (`sprawdził kret` / `z Twoich odpowiedzi` / `niepotwierdzone`).

## Run it

Requirements: Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node 20+, optionally [Ollama](https://ollama.com).

```bash
# backend (http://127.0.0.1:8000)
cd backend
uv sync
uv run uvicorn app.main:app --port 8000 --reload

# frontend (http://localhost:5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Local model (optional, the app works without it in "rules and templates" mode):

```bash
ollama serve
ollama pull <qwen tag>          # e.g. a Qwen 3.x model that fits in RAM; we use a 48 GB machine
export OLLAMA_MODEL=<qwen tag>  # if unset or missing, the first local "qwen" model is used
```

Tests: `cd backend && uv run pytest` (engines, mail heuristics, incident flow, LLM guardrails with a faked model).

Reset demo data: menu `⋯` → *Reset danych demo*, or `POST /api/demo/reset`.

## Demo script (≈3 min)

1. `/` – intro animation: something moves in the office cables at night… it is your mole.
2. `/app/tunele` – *Wpuść kreta*. Cables light up; 5 tunnels to client files, money and business continuity. First move: close RDP (15 min).
3. `/app/poczta` – turn Wi‑Fi off. *Przyślij nowy mail (demo)*: fake Biurex invoice. The mole flags the lookalike domain, Reply-To, fake PDF with a bank login form. *Zgłoś incydent*.
4. Incident – "Did anyone pay?" → *Nie wiem jeszcze*. Then the new fact *Tak, przelew wyszedł*: plan rebuilds (bank recall, police), log shows the diff.
5. Continuity – tick the court-hearing and payments confirmations; only then *Kancelaria działa*.
6. Close incident → fill tunnels (callback rule, DMARC, MFA) → the mole digs again: before 5, after fewer.

## Architecture

```
backend/app
  kret/techniques.py   attack techniques (src → dst, required missing safeguards)
  kret/engine.py       DFS over techniques → tunnels, greedy "fill first", chamber status
  kret/domain_check.py passive DNS + one GET, SSRF guard, consent required
  kret/local_agent.py  read-only macOS checks with timeouts
  mail/analyze.py      .eml heuristics → verdict → local model explanation
  incident/playbook.py questions, actions with when(ctx) rules, continuity, messages
  incident/engine.py   facts, hypotheses, plan, continuity, UODO clock
  llm/ollama.py        localhost-only client, JSON mode, fallback on any error
  routers/             REST API (org, kret, mail, incidents, demo)
frontend/src
  components/Mascot.tsx     original mole mascot (SVG, poses)
  components/TunnelMap.tsx  office cross-section, cables, mole animation, attack tunnels
  views/                    Dashboard, Tunnels, Mail, Incidents, IncidentView
  landing/                  marketing page with the plot-twist intro
```

Stored: map, answers, statuses, confirmations, scans. Computed on every read: tunnels, situation, plan.

## Honest scope

Real: path engine, passive domain check, local agent, `.eml` analysis, local model with fallback, incident engine.
Simulated: the Kancelaria Nowak map (fictional company, survey-style answers), the inbox (sample emails on `.example` domains).
Deliberately not done: port scans of other machines, login attempts, executing attachments, sending anything outside.

## Credits and AI disclosure

- Mascot and all graphics: original, drawn in SVG for this project. Not based on any existing cartoon character.
- Libraries: FastAPI, Uvicorn, Pydantic, dnspython, HTTPX, pytest, React, React Router, Vite, TypeScript, Fontsource (Bricolage Grotesque, IBM Plex Sans/Mono, SIL OFL).
- Local model: Qwen (Alibaba Cloud, Apache 2.0) served by Ollama.
- AI tools were used during development (concept, code, copy). The team reviewed and can explain every part.
- Concept, plan and a first prototype were prepared before the hackathon start (3 Oct, 23:00). The submission notes separate that from the work done during the event.
