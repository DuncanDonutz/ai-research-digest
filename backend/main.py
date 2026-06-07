import json
import os
import re
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from typing import Optional

import anthropic
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

load_dotenv()

ARXIV_URL_RE = re.compile(r"arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5})", re.IGNORECASE)
MAX_TEXT_LENGTH = 10_000


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key."
        )
    yield


app = FastAPI(title="AI Research Digest API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class URLRequest(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def must_be_arxiv(cls, v: str) -> str:
        if not ARXIV_URL_RE.search(v):
            raise ValueError(
                "Must be a valid arXiv URL, e.g. https://arxiv.org/abs/2408.06292"
            )
        return v


class TextRequest(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def must_have_content(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 50:
            raise ValueError("Text is too short — please paste a full abstract.")
        if len(v) > MAX_TEXT_LENGTH:
            raise ValueError(
                f"Text is too long — please paste the abstract only (max {MAX_TEXT_LENGTH:,} characters)."
            )
        return v


# ---------------------------------------------------------------------------
# arXiv fetching
# ---------------------------------------------------------------------------


async def fetch_arxiv_abstract(paper_id: str) -> tuple[str, Optional[str]]:
    """Queries the arXiv Atom API and returns (abstract_text, paper_title)."""
    api_url = f"https://export.arxiv.org/api/query?id_list={paper_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(api_url)
        r.raise_for_status()

    root = ET.fromstring(r.text)
    ns = {"a": "http://www.w3.org/2005/Atom"}

    entry = root.find("a:entry", ns)
    if entry is None:
        raise ValueError(f"Paper '{paper_id}' not found on arXiv.")

    summary_el = entry.find("a:summary", ns)
    if summary_el is None or not summary_el.text:
        raise ValueError("arXiv returned no abstract for this paper.")

    title_el = entry.find("a:title", ns)
    title = (
        " ".join(title_el.text.split())
        if title_el is not None and title_el.text
        else None
    )

    # arXiv abstracts have hard-wrapped newlines — collapse to single spaces
    abstract = " ".join(summary_el.text.split())
    return abstract, title


# ---------------------------------------------------------------------------
# Claude integration
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are an expert AI researcher and science communicator. "
    "Read the research paper abstract and produce an accurate, insightful digest "
    "for a technical but non-specialist audience. "
    "Do not hallucinate claims not present in the abstract. "
    "If a section cannot be inferred from the abstract, say so briefly."
)

# Tool definition enforces the exact four-field JSON structure we need.
DIGEST_TOOL = {
    "name": "create_digest",
    "description": "Produce a structured digest of a research paper abstract.",
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": (
                    "3-4 sentence plain-English summary. "
                    "No jargon — a smart non-expert should understand it."
                ),
            },
            "contributions": {
                "type": "string",
                "description": "3-5 bullet points (markdown) of what is new or novel in this work.",
            },
            "limitations": {
                "type": "string",
                "description": (
                    "What the authors admit doesn't work yet, or open questions that remain. "
                    "Use markdown bullet points."
                ),
            },
            "so_what": {
                "type": "string",
                "description": (
                    "2-3 sentences on real-world implications and why this matters "
                    "for AI products or the field."
                ),
            },
            "confidence": {
                "type": "object",
                "description": (
                    "Your confidence in each section based solely on what the abstract provides. "
                    "For each key, write 'High', 'Medium', or 'Low' followed by a dash and one sentence explaining why. "
                    "Example: 'Low — the abstract does not mention any limitations.'"
                ),
                "properties": {
                    "summary":       {"type": "string"},
                    "contributions": {"type": "string"},
                    "limitations":   {"type": "string"},
                    "so_what":       {"type": "string"},
                },
                "required": ["summary", "contributions", "limitations", "so_what"],
            },
        },
        "required": ["summary", "contributions", "limitations", "so_what", "confidence"],
    },
}


def sse(payload: dict) -> str:
    """Formats a dict as a Server-Sent Events data line."""
    return f"data: {json.dumps(payload)}\n\n"


async def generate_digest_stream(abstract: str):
    """
    Async generator that yields SSE strings.

    Streams input_json_delta chunks while Claude writes the tool response,
    then emits the final structured result as a single 'result' event.

    SSE event types emitted:
      status  — human-readable progress message
      chunk   — raw JSON fragment being written by Claude (used for typing animation)
      result  — final parsed digest { summary, contributions, limitations, so_what }
      error   — something went wrong; message field has detail
      done    — stream complete
    """
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    yield sse({"type": "status", "message": "Analyzing with Claude..."})

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    # Prompt caching: the system prompt never changes between requests,
                    # so Anthropic caches it after the first call. This cuts both
                    # latency (~200ms saved) and token cost on every subsequent request.
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=[DIGEST_TOOL],
            # Force exactly this tool — guarantees structured output every time.
            tool_choice={"type": "tool", "name": "create_digest"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Create a digest for this research paper abstract:\n\n{abstract}"
                    ),
                }
            ],
        ) as stream:
            async for event in stream:
                # input_json_delta carries the JSON being written character-by-character.
                # We forward these so the frontend can show a live typing animation.
                if (
                    event.type == "content_block_delta"
                    and getattr(event.delta, "type", None) == "input_json_delta"
                ):
                    yield sse({"type": "chunk", "text": event.delta.partial_json})

            final_message = await stream.get_final_message()

        tool_block = next(
            (b for b in final_message.content if b.type == "tool_use"), None
        )
        if tool_block is None:
            yield sse(
                {
                    "type": "error",
                    "message": "Claude returned no structured digest. Please try again.",
                }
            )
            return

        yield sse({"type": "result", "data": tool_block.input})
        yield sse({"type": "done"})

    except anthropic.AuthenticationError:
        yield sse(
            {
                "type": "error",
                "message": "Invalid Anthropic API key. Check your .env file.",
            }
        )
    except anthropic.APIStatusError as e:
        yield sse(
            {
                "type": "error",
                "message": f"Claude API error ({e.status_code}): {e.message}",
            }
        )
    except Exception as e:
        yield sse({"type": "error", "message": str(e)})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/digest/url")
async def digest_from_url(req: URLRequest):
    paper_id = ARXIV_URL_RE.search(req.url).group(1)

    async def stream():
        yield sse({"type": "status", "message": "Fetching paper from arXiv..."})
        try:
            abstract, title = await fetch_arxiv_abstract(paper_id)
        except httpx.HTTPStatusError as e:
            yield sse(
                {
                    "type": "error",
                    "message": f"arXiv returned an error ({e.response.status_code}). Check the URL.",
                }
            )
            return
        except httpx.RequestError:
            yield sse(
                {
                    "type": "error",
                    "message": "Could not reach arXiv. Check your internet connection.",
                }
            )
            return
        except ValueError as e:
            yield sse({"type": "error", "message": str(e)})
            return

        if title:
            yield sse({"type": "title", "text": title})

        async for chunk in generate_digest_stream(abstract):
            yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.post("/digest/text")
async def digest_from_text(req: TextRequest):
    async def stream():
        async for chunk in generate_digest_stream(req.text):
            yield chunk

    return StreamingResponse(stream(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}
