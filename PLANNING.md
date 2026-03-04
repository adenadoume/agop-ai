# agop-ai — Planning & Architecture

## Overview
Personal AI chatbot built on Claude API. Full streaming chat, history, file uploads, artifact rendering, memory sharing with Claude Code.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Ant Design 5 |
| Backend | FastAPI + Python 3.11 |
| Database | Supabase (project: agop-ai) |
| Frontend Deploy | Vercel (auto-deploy on git push) |
| Backend Deploy | Oracle VM 141.147.44.143 (Docker, port 8001) |
| CI/CD | GitHub Actions → Oracle VM SSH deploy |
| Repo | https://github.com/adenadoume/agop-ai |

---

## Supabase
- URL: https://ikrwffjpvfzdymphhchk.supabase.co
- Tables: conversations, messages, uploaded_files

---

## Oracle VM Backend
- SSH alias: oracle-softone (~/.ssh/config)
- SSH key: ~/.ssh/id_ed25519_ioagop
- App path: ~/agop-ai/
- Container: agop-ai-backend
- Port: 8001 (host) → 8000 (container)
- Existing app (softone-report) stays on port 80

### Manual setup on VM (first time):
```bash
ssh oracle-softone
mkdir -p ~/agop-ai
# Create .env file:
cat > ~/agop-ai-backend.env << EOF
ANTHROPIC_API_KEY=sk-ant-YOUR_KEY_HERE
SUPABASE_URL=https://ikrwffjpvfzdymphhchk.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY_HERE
ALLOWED_ORIGINS=https://agop-ai.vercel.app,http://localhost:5173
EOF
```

### Open port 8001 on Oracle Cloud:
Oracle Console → Networking → VCN → Security List → Add Ingress Rule:
- Protocol: TCP
- Destination Port: 8001

### Also open in Ubuntu firewall:
```bash
sudo ufw allow 8001/tcp
```

### HTTPS (required for Vercel → Oracle):
Option A: Cloudflare Tunnel (free, recommended)
```bash
# Install cloudflared on VM
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
cloudflared tunnel --url http://localhost:8001
# Copy the https://*.trycloudflare.com URL → set as VITE_API_URL in Vercel
```

Option B: Own domain + nginx + certbot (more permanent)

---

## GitHub Actions Secrets Required
Go to: https://github.com/adenadoume/agop-ai/settings/secrets/actions

| Secret | Value |
|---|---|
| ORACLE_HOST | 141.147.44.143 |
| ORACLE_USER | ubuntu |
| ORACLE_SSH_KEY | contents of ~/.ssh/id_ed25519_ioagop |

---

## Vercel Setup (manual)
1. Connect GitHub repo adenadoume/agop-ai
2. Set Root Directory: `frontend`
3. Framework: Vite
4. Add env vars:
   - VITE_SUPABASE_URL = https://ikrwffjpvfzdymphhchk.supabase.co
   - VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlrcndmZmpwdmZ6ZHltcGhoY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MTM1NzEsImV4cCI6MjA4ODE4OTU3MX0.kXrE3zs8K5Q0QhqMhwcAWIlO5wj6WfvJ16yBn-iO-Yk
   - VITE_API_URL = https://YOUR_ORACLE_OR_CLOUDFLARE_URL

---

## Cost Optimisation (baked in)
1. **Prompt caching** — system prompt cached, 90% cheaper after first message
2. **Model routing** — Sonnet default; user picks Haiku/Opus manually; Haiku silently for title generation + summarization
3. **Conversation truncation** — last 12 messages sent; older messages summarised by Haiku
4. **Input compression** — Excel/PDF stripped before sending
5. **max_tokens per model** — Haiku: 1024, Sonnet: 4096, Opus: 8192
6. **Cancel streaming** — ESC key stops generation (no wasted tokens)
7. **Batch API** — Phase 2: bulk Excel/PDF processing at 50% discount

---

## Features — V1
- [x] Streaming chat (SSE)
- [x] Conversation list with search
- [x] Chat history in Supabase
- [x] Model selector (Haiku / Sonnet / Opus)
- [x] Cost tracker per message + session total
- [x] MEMORY.md injection as system prompt (prompt cached)
- [x] Dark theme (purple accent, Inter font, Ant Design 5)
- [x] Auto conversation title generation (Haiku)
- [x] Cancel streaming (ESC / button)
- [x] GitHub CI/CD → Vercel + Oracle VM

## Features — V2
- [ ] File uploads (PDF, images, Excel)
- [ ] Artifact viewer (HTML/React iframe sandbox)
- [ ] Plan mode (extended thinking)
- [ ] MEMORY.md sync (Supabase ↔ local file)
- [ ] Batch jobs panel
- [ ] On-demand local file reads

---

## Memory Sharing with Claude Code
The agop-ai memory is stored in Supabase `memory` table (key-value).
Claude Code reads: ~/.claude/projects/-Users-nucintosh/memory/MEMORY.md

Sync script (run locally):
```bash
python3 scripts/sync-memory.py
# Pulls memory from Supabase → writes to MEMORY.md
# Run manually or add to cron: */30 * * * * python3 /path/sync-memory.py
```

---

## Pricing Reference (per 1M tokens)
| Model | Input | Output | Cached Input |
|---|---|---|---|
| claude-haiku-4-5 | $0.25 | $1.25 | $0.03 |
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 |
| claude-opus-4-6 | $15.00 | $75.00 | $1.50 |
