# Acceptance Status

Against A1–A8 in `docs/PRD.md`, verified against live models on the replay build.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | One command starts everything, healthy in 30s | **pass** | `npm run dev` starts web, hr, it and policy; `/api/health` lists all three agents `live` |
| A2 | A single-domain question uses exactly one domain | **pass** | "How many vacation days do I have left?" → `hr.find_employee` only → "22 remaining out of 25" |
| A3 | A cross-domain question uses two domains concurrently | **pass** | "Who is my manager, and what tickets have I opened?" → `hr.find_employee` (11ms) + `it.list_tickets` (11ms) → one answer |
| A4 | An unanswerable question is refused, not guessed | **pass** | "When is the company holiday party?" → `calls: []` → explicit refusal |
| A5 | Stopping a server degrades instead of crashing | **pass** | IT killed: `hr.find_employee ok`, `it.list_tickets FAIL fetch failed`, answer gives the manager and names what it could not retrieve; `/api/health` reports `degraded` with `it` `stale` after three missed beats |
| A6 | A new agent needs zero changes under `apps/web` | **pass** | `servers/policy` added in 22 files / 275 lines; `git diff HEAD~1 HEAD -- apps/web` empty |
| A7 | Changing the LLM channel changes no application code | **pass** | `LLM_PROVIDER=portkey` and `=direct` both answer; `git diff --stat` empty afterwards |
| A8 | Every stage is visible before the answer completes | **pass** | SSE emits one `plan`, one `execute` per call with timings, then `answer` deltas; no frame outside the four types |

## Also verified

| Claim | Evidence |
|---|---|
| Real MCP over Streamable HTTP | `npm run smoke` walks initialize → tools/list → tools/call against every registered agent |
| Real MCP over stdio | `npm run smoke:stdio` |
| A smoke script that can fail | pointed at a dead port it exits 1 |
| Capabilities are earned | `initialize` reported `{}` at Prompt 2 and reports `tools` from Prompt 3 |
| A missing key fails by name | `PORTKEY_API_KEY is required for LLM_PROVIDER=portkey`, immediately |
| Single-shot planning limit | "Who else reports to my manager?" → the manager is given, the rest is refused |
| Types and units | `npm run typecheck` clean; 17 tests pass |

## Not verified here

| Claim | Why |
|---|---|
| `make demo` (docker compose, four services) | Docker is not installed on this machine. The compose path is exercised on the lab node; see `docs/DEPLOY.md`. |
