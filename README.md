# CyberKret

CyberKret is a small local web app that helps a small company prepare for a cyber incident and keep working when one happens. A friendly mole digs through a map of the company's services and shows which chains of small gaps lead to the things that matter: client data, client money, invoices and deadlines. When something goes wrong, it builds a response plan that changes with every new fact and tracks whether critical work is really maintained.

The demo uses a fictional accounting office, Biuro Rachunkowe Saldo, and a business email fraud scenario: clients receive emails "from the office" with a new bank account number.

## Features

- Attack path map: a cross-section of the ground under the office. Each path is built from simple rules (for example missing MFA plus a shared password), shown as a tunnel, and animated when the mole digs.
- "Close first": a greedy choice of the safeguards that cut the most paths, with effort estimates.
- Passive domain check: SPF, DMARC, DKIM, HTTPS, HSTS, security headers and certificate expiry. DNS and one request to the home page only, with protection against private addresses.
- Suspicious message check: deterministic rules plus an optional local model through Ollama. Model quotes are accepted only if they appear in the message. Nothing leaves the computer.
- Incident mode: confirmed and unverified facts, two hypotheses (mailbox takeover or spoofing), a plan for the first 30 minutes with roles and statuses, and a dependency map of untrusted services and fallback channels.
- Continuity mode: critical activities with confirmations. The "maintained" status appears only when every critical confirmation is checked.
- Decision log stored in SQLite, so the incident survives a page refresh.
- Lessons: after closing an incident, apply the fixes and let the mole dig again to compare paths before and after.
- Password strength check with zxcvbn and a Polish dictionary, computed in the browser only.

## Run locally

Requirements: Python 3.12, Node 24. Ollama is optional.

Backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:create_app --factory --reload --port 8000
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

Optional local model: install Ollama, pull a model and set `OLLAMA_MODEL` in `backend/.env` (see `backend/.env.example`). Without a model the message check runs on rules only.

```bash
ollama pull SpeakLeash/bielik-11b-v3.0-instruct:Q8_0
```

Tests and checks:

```bash
cd backend && .venv/bin/pytest && .venv/bin/ruff check .
cd frontend && npm run lint && npm run build
```

## Data and credits

- All company data, people, phone numbers and the domain `saldo.example` are fictional.
- Bielik language models by SpeakLeash, run locally through Ollama.
- zxcvbn-ts for password strength estimation.
- Fonts: Bricolage Grotesque, IBM Plex Sans and IBM Plex Mono (SIL Open Font License), bundled through Fontsource.
- Built with FastAPI, React, Vite and SQLite.
