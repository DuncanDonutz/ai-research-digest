# AI Research Digest

Transform arXiv papers into structured, readable digests powered by the Claude API.

Paste an arXiv URL or a raw abstract and get back four sections, a plain-English summary, key contributions, limitations, and real-world implications, each with a confidence indicator showing how much the abstract actually supported that section.

<div align="center">
  <img width="600" height="667" alt="Screenshot 2026-06-07 183552" src="https://github.com/user-attachments/assets/bfd7dc7a-0032-4d27-ab59-a58af6222760" />
  <img width="600" height="663" alt="Screenshot 2026-06-07 183632" src="https://github.com/user-attachments/assets/70f2c452-f4af-400f-9e1c-2bd2ee9da8f3" />
</div>

---

## Features

- **arXiv URL or raw text** - paste a link or drop in an abstract directly
- **Four digest sections** - Summary, Key Contributions, Limitations & Open Questions, So What?
- **Per-section confidence** - Claude rates its own confidence (High / Medium / Low) for each section based on what the abstract actually contains
- **Live streaming** - response streams in real time via Server-Sent Events; a typing animation plays while Claude writes
- **Clickable paper title** - links back to the original arXiv page
- **Three built-in examples** - The AI Scientist, Transformer², Attention Is All You Need

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, react-markdown |
| Backend | Python 3.12, FastAPI, uvicorn |
| LLM | Claude (`claude-sonnet-4-6`) via Anthropic Python SDK |
| HTTP client | httpx (async) |
| Containerisation | Docker, Docker Compose |

---

## How it works

1. The user submits an arXiv URL or pastes raw text in the browser.
2. The frontend POSTs to `/digest/url` or `/digest/text` and opens a streaming connection (Server-Sent Events over `fetch`).
3. For URLs, the backend extracts the paper ID and fetches the abstract from the arXiv Atom API.
4. The backend calls Claude using **tool use**, which guarantees a structured JSON response with exactly the fields the frontend expects, no fragile JSON parsing.
5. The system prompt is **prompt-cached**, after the first request, Anthropic serves it from cache, cutting latency and cost on every subsequent call.
6. Claude's response streams back as `input_json_delta` chunks. The backend forwards these as SSE events so the frontend can show a live typing animation.
7. When the final `result` event arrives, the frontend renders the four digest cards with confidence indicators.

---

## Local setup (without Docker)

### Prerequisites

- Python 3.12+
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/ai-research-digest.git
cd ai-research-digest

cp .env.example .env
# This creates a new .env file — open .env (not .env.example) and replace the placeholder with your real key
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend is now running at `http://localhost:8000`. Test it:

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

### 3. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend is now running at `http://localhost:5173`.

---

## Local setup (with Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and configure

```bash
git clone https://github.com/your-username/ai-research-digest.git
cd ai-research-digest

cp .env.example .env
# This creates a new .env file — open .env (not .env.example) and replace the placeholder with your real key
```

### 2. Build and run

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

The backend reloads automatically when you edit `backend/main.py`. The frontend hot-reloads when you edit any file in `frontend/src/`.

To stop:

```bash
docker compose down
```

---

## API reference

### `POST /digest/url`

Fetches the abstract from arXiv and returns a streamed digest.

```json
{ "url": "https://arxiv.org/abs/2408.06292" }
```

### `POST /digest/text`

Accepts raw text (abstract or excerpt) and returns a streamed digest.

```json
{ "text": "We present a fully automated system for scientific discovery..." }
```

Both endpoints return a `text/event-stream` response. Event types:

| Type | Payload | Meaning |
|---|---|---|
| `status` | `{ "message": "..." }` | Human-readable progress update |
| `title` | `{ "text": "..." }` | Paper title (URL path only) |
| `chunk` | `{ "text": "..." }` | Raw JSON fragment from Claude (triggers typing animation) |
| `result` | `{ "data": { summary, contributions, limitations, so_what, confidence } }` | Final structured digest |
| `error` | `{ "message": "..." }` | Something went wrong |
| `done` | — | Stream complete |

### `GET /health`

Returns `{"status": "ok"}`. Useful for container health checks.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com/) |

---

## Project structure

```
ai-research-digest/
├── backend/
│   ├── main.py           # FastAPI app — arXiv fetch, Claude tool use, SSE streaming
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # State machine + SSE reader
│   │   └── components/
│   │       ├── InputForm.jsx     # URL / text input with three example papers
│   │       ├── LoadingState.jsx  # Spinner + live status
│   │       ├── DigestCard.jsx    # Result card with confidence indicator
│   │       └── ResultView.jsx    # Four-card layout with linked paper title
│   ├── Dockerfile
│   └── .dockerignore
├── docker-compose.yml
├── .env.example
└── README.md
```
