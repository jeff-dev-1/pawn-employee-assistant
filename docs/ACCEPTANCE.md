# Acceptance Status

Against the A1–A8 criteria in `docs/PRD.md`. Verified 2026-08-31 against live models:
DeepSeek plans, Kimi writes, both through Portkey. **All eight pass.**

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | One command starts everything, healthy in 30s | **pass** | Both paths: `npm run dev` brings up web, hr, it and policy with all three agents `live`, and `docker compose up -d` brings up `pawn-web`, `pawn-hr`, `pawn-it`, `pawn-policy` healthy. The local path was broken until 2026-08-31 — see `docs/REPLAY-FINDINGS.md` #6 and #7 |
| A2 | A single-domain question uses exactly one domain | **pass** | "How many vacation days do I have left?" → `hr.find_employee` only → "You have 22 vacation days left, out of a total of 25." |
| A3 | A cross-domain question uses two domains concurrently | **pass** | "Who is my manager, and what tickets have I opened?" → `hr.find_employee` (36ms) + `it.list_tickets` (43ms) → one answer naming Tomas Berg and three tickets |
| A4 | An unanswerable question is refused, not guessed | **pass** | "When is the company holiday party?" → empty plan → explicit refusal, no invention |
| A5 | Stopping a server degrades instead of crashing | **pass** | IT stopped: HR half answered and the gap named; `/api/health` reports `degraded` with `it` `stale` after three missed heartbeats. Regression available at `prompt-10-bug` for contrast. |
| A6 | A new agent needs zero changes under `apps/web` | **pass** | `servers/policy` added at `prompt-9`: 23 files, 283 lines, and `git diff --stat prompt-8 prompt-9 -- apps/web` is empty |
| A7 | Changing the LLM channel changes no application code | **pass** | same question answered on `portkey` and on `direct`; `git diff --stat` empty |
| A8 | Every stage is visible before the answer completes | **pass** | SSE emits `plan`, one `execute` per call with timings, then `answer` deltas |

## Also verified

| Claim | Evidence |
|---|---|
| Real MCP over HTTP | `npm run smoke` — initialize, tools/list, tools/call |
| Real MCP over stdio | `npx tsx scripts/smoke-stdio.ts` |
| Two vendors serve one answer | `PLANNER_VENDOR=deepseek MODEL_PLANNER=deepseek-v4-flash` with `WRITER_VENDOR=moonshot MODEL_WRITER=kimi-k3` |
| A missing key fails by name | `PORTKEY_API_KEY is required for LLM_PROVIDER=portkey`, immediately, not as a timeout |
| A failing writer is reported | wrong model id surfaced as `Not found the model ... or Permission denied`, not as an empty answer |
| Single-shot planning limit | "Who else reports to my manager?" → 7 runs, 7 refusals: empty plan, or `find_employee` alone with the unanswerable half named. `get_team` needs a manager name that only the first call can supply, and no over-fetch produces one |
| The limit does not always refuse | "Which tickets is my manager waiting to approve?" → 7 runs: 1 refusal, 6 over-fetches (`find_employee` + every `awaiting_approval` ticket) that let synthesis do the join. All six answers were correct. Over-fetching substitutes for chaining until the fetched set stops fitting in the context window |
| Three agents answer their own domain | "What is the remote work policy?" → `policy.search_policy` 16ms → the clause, quoted |
| Types and units | `npm run typecheck` clean; **24 pass and 3 skip** — the skipped three are the pipeline suite, which `describe.skipIf` disables when the MCP servers are not running, exactly as Prompt 7 asks. Start them and it is 27 |
| Every prompt-N tag runs standalone | **All twelve booted from clean checkouts, 76 checks, 76 pass** — each tag runs the acceptance commands its own PROMPT block carries, re-run after the line cap changed. Reproduce with `bash scripts/verify-tags.sh` |
| The line cap is met by the rule that is written down | 1 581 of 2 400 on `main`, 1 447 at `prompt-11`, comments and blank lines excluded |
| The manual builds the system | Full replay of Prompts 0–11 from `start`; see `docs/REPLAY-FINDINGS.md` |
