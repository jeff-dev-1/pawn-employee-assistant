# Employee Assistant

An internal employee assistant. Ask a question in natural language; the system decides which
data domains to consult, fetches from them concurrently, and composes one answer.

> "Who is my manager, and what tickets have I opened?"
> → HR and IT are queried in parallel, and one answer comes back.

Four processes: a Next.js orchestrator plus three MCP servers (HR, IT, Policy). All reasoning
lives in the orchestrator; the MCP servers are pure capability providers with no LLM inside.

## Two ways to use this repository

### 1. Run it

```bash
npm install
cp .env.example .env          # then put your key in it
npm run dev                   # four processes, or: make demo (needs Docker)
open http://localhost:3000
```

```bash
curl -s localhost:3000/api/health    # the orchestrator and every registered agent
npm run smoke                        # initialize -> tools/list -> tools/call, every agent
make check                           # typecheck + tests
```

Every model call goes to a public endpoint: the Portkey gateway (`LLM_PROVIDER=portkey`) or a
vendor directly (`LLM_PROVIDER=direct`). There is no locally hosted model.

### 2. Build it from zero yourself

```bash
git checkout -b my-build start
open docs/BUILD-FROM-ZERO.md
```

Fell behind? `git checkout prompt-N` rejoins at the end of step N.

## Register a server with a host

Claude Desktop accepts **stdio servers only**, and every path must be absolute:

```json
{
  "mcpServers": {
    "pawn-hr": { "command": "npx", "args": ["tsx", "/Users/zoujun/Documents/workspace/pawn-replay/servers/hr/src/stdio.ts"] }
  }
}
```

## Documentation

| File | For |
|---|---|
| `docs/BUILD-FROM-ZERO.md` | Students: Prompts 0–11 with acceptance commands |
| `DESIGN.md` | Architecture and what was deliberately cut |
| `docs/PRD.md` | Scope and the A1–A8 criteria |
| `docs/ACCEPTANCE.md` | A1–A8 status with evidence |
| `docs/TEST-CASES.md` | Cases the instructor reads aloud |
