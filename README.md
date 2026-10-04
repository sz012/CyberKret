<p align="center">
  <img src="docs/intro.gif" width="800" alt="Opening animation: something moves in the office network at night. It is your own mole, which then shows the path an attacker would take to client files.">
</p>

<p align="center"><b>Demo video</b> (3 min, no sound): <a href="demo.mp4">demo.mp4</a> · <b>Slides</b> (PDF, Polish): <a href="docs/cyberKret-prezentacja.pdf">cyberKret-prezentacja.pdf</a></p>

cyberKret is a local security assistant for small firms without an IT department. It maps the firm, finds the paths an attacker would take from the internet to client data, money or a stopped business ("tunnels"), and picks the changes that close the most of them. When something happens, it walks the team through the incident. Everything runs on one computer and the language model is local, so the firm's data never leaves it.

The interface is in Polish.

## Features

- **Tunnels.** An attack graph of 8 techniques over 12 safeguards. A depth-first search finds every path from the internet to a target, and a greedy pass picks the safeguards that cut the most target weight first, with time and cost. Every finding says where it comes from: checked by the app, from your answers, or unverified.
- **Real checks.** A passive domain check (MX, SPF, DMARC, DKIM, HTTPS certificate and redirect, security headers), read-only checks of this Mac (firewall, FileVault, Gatekeeper, SIP, automatic updates) and a password strength meter that runs only in the browser (zxcvbn-ts with a Polish dictionary and the firm's own words).
- **Mail mole.** Reads a mailbox over IMAP (read-only, nothing is marked as read), `.eml` files or pasted text. Rules decide the verdict: lookalike sender domains, Reply-To mismatch, SPF/DKIM/DMARC results, account change requests, link text that hides another domain, double extensions, fake PDFs, password forms inside attachments. The local model explains the verdict in plain Polish. It may raise the alarm but never lower it, and its quotes must exist in the message.
- **Incident mode.** Five playbooks: fake invoice or account change request, ransomware, lost or stolen laptop, account takeover, internet or mail outage. Each one asks a few questions, keeps confirmed and unverified facts apart, weighs hypotheses and rebuilds the plan after every answer. Steps go to people by duty, critical work needs confirmed fallbacks, messages are ready to send, and a 72-hour clock starts when personal data may have leaked.
- **Your firm.** People and duties, vendors with phone numbers from the contract, fallback channels and safeguard answers. A fictional demo firm is included.
- **Emergency card.** A printable page with first steps for every incident type, roles, fallback channels and vendor phone numbers.
- **Presentation.** `/demo` plays a 96-second story using the opening animation and actual rule-engine results for the fictional firm. It does not modify the saved firm. Local narration clips can extend each scene. Recording instructions and the Polish voiceover script are in [docs/demo.md](docs/demo.md).

## Run locally

Requirements: Python 3.12+, Node 20+, optionally [Ollama](https://ollama.com).

Backend (http://127.0.0.1:8000):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install fastapi "uvicorn[standard]" dnspython httpx pydantic pytest
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

With [uv](https://docs.astral.sh/uv/): `uv sync`, then `uv run uvicorn app.main:app --port 8000 --reload`.

Frontend (http://localhost:5173, proxies `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Local model (optional, without it the app uses rules and templates). The default fits a Mac with 8 GB of RAM:

```bash
ollama pull hf.co/second-state/Bielik-4.5B-v3.0-Instruct-GGUF:Q4_K_M
```

Settings live in `.env.local` in the repository root (copy `.env.example`). To read Gmail, turn on 2-step verification, create an app password at https://myaccount.google.com/apppasswords and set `IMAP_USER` and `IMAP_PASSWORD`. Restart the backend after changes.

Tests: `backend/.venv/bin/pytest backend/tests`. The real-model tests run only when Ollama has a model.

Frontend checks (from `frontend`): `npm test`, `npm run lint`, `npm run build`.

## Data and credits

- The demo firm, its people, vendors, domains, emails and account numbers are fictional.
- Language model: Bielik 4.5B v3.0 Instruct by SpeakLeash (Apache 2.0), GGUF quantization by Second State, served by Ollama.
- Libraries: FastAPI, Uvicorn, Pydantic, dnspython, HTTPX, pytest, React, React Router, Vite, TypeScript, zxcvbn-ts.
- Fonts: Mona Sans by GitHub and JetBrains Mono, both under the SIL Open Font License.
