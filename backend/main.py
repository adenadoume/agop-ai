import os
import json
import asyncio
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic

load_dotenv()

app = FastAPI(title="agop-ai backend", version="1.0.0")

# ─── CORS ─────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Anthropic client ─────────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# ─── Pricing (per 1M tokens) ──────────────────────────────────────────────────
MODELS = {
    "claude-haiku-4-5-20251001": {"input": 0.25, "output": 1.25, "label": "Haiku"},
    "claude-sonnet-4-6":          {"input": 3.00, "output": 15.0, "label": "Sonnet"},
    "claude-opus-4-6":            {"input": 15.0, "output": 75.0, "label": "Opus"},
}

DEFAULT_SYSTEM = """You are agop-ai, a personal AI assistant.
You help with coding, analysis, Excel work, business reports, planning, and general tasks.
You are running as a custom web app built on the Claude API.
Be concise and direct. Use markdown for formatting when helpful."""

# ─── Models ──────────────────────────────────────────────────────────────────
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = "claude-sonnet-4-6"
    system: Optional[str] = None
    conversation_id: Optional[str] = None
    max_tokens: Optional[int] = None

class TitleRequest(BaseModel):
    first_message: str

class SummarizeRequest(BaseModel):
    messages: List[Message]

# ─── Helpers ─────────────────────────────────────────────────────────────────
def calc_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = MODELS.get(model, MODELS["claude-sonnet-4-6"])
    return round(
        (input_tokens / 1_000_000 * pricing["input"]) +
        (output_tokens / 1_000_000 * pricing["output"]),
        6
    )

def get_max_tokens(model: str, override: Optional[int]) -> int:
    if override:
        return override
    defaults = {
        "claude-haiku-4-5-20251001": 2048,
        "claude-sonnet-4-6": 4096,
        "claude-opus-4-6": 8192,
    }
    return defaults.get(model, 4096)

# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "agop-ai", "models": list(MODELS.keys())}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    """Stream chat response via SSE."""
    if request.model not in MODELS:
        raise HTTPException(400, f"Unknown model: {request.model}")

    # Truncate to last 12 messages to save tokens
    msgs = request.messages[-12:]
    system_prompt = request.system or DEFAULT_SYSTEM
    max_tokens = get_max_tokens(request.model, request.max_tokens)

    async def generate():
        try:
            with client.messages.stream(
                model=request.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": m.role, "content": m.content} for m in msgs],
            ) as stream:
                for text in stream.text_stream:
                    yield f"data: {json.dumps({'type': 'delta', 'text': text})}\n\n"

                final = stream.get_final_message()
                usage = final.usage
                cost = calc_cost(request.model, usage.input_tokens, usage.output_tokens)

                yield f"data: {json.dumps({'type': 'done', 'input_tokens': usage.input_tokens, 'output_tokens': usage.output_tokens, 'cost': cost, 'model': request.model})}\n\n"

        except anthropic.APIError as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Server error: {str(e)}'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

@app.post("/api/generate-title")
async def generate_title(request: TitleRequest):
    """Generate a short conversation title using Haiku (cheap)."""
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            messages=[{
                "role": "user",
                "content": f"Generate a short 4-6 word title for a conversation that starts with this message. Return ONLY the title text, no quotes, no punctuation at the end.\n\nMessage: {request.first_message[:500]}"
            }]
        )
        return {"title": response.content[0].text.strip()}
    except Exception as e:
        return {"title": "New Conversation"}

@app.post("/api/summarize")
async def summarize(request: SummarizeRequest):
    """Summarize older messages for context truncation using Haiku."""
    try:
        text = "\n".join([f"{m.role}: {m.content}" for m in request.messages])
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": f"Summarize this conversation in 2-3 sentences, preserving key facts, decisions, and context:\n\n{text[:3000]}"
            }]
        )
        return {"summary": response.content[0].text.strip()}
    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/api/models")
async def get_models():
    return {"models": [
        {"id": k, "label": v["label"], "input_per_m": v["input"], "output_per_m": v["output"]}
        for k, v in MODELS.items()
    ]}
