# Acceptance Status

Against A1–A8 in `docs/PRD.md`, after Prompt 4.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| A1 | One command starts everything, healthy in 30s | **pass (partial scope)** | `npm run dev` starts web and hr; both health reports return ok. Two of the eventual four processes exist. |
| A2 | A single-domain question uses exactly one domain | **not implemented** | There is no planner yet. |
| A3 | A cross-domain question uses two domains concurrently | **not implemented** | Only one domain exists. |
| A4 | An unanswerable question is refused, not guessed | **partial** | At tool level a miss returns a structured `not_found`; there is no natural-language refusal yet. |
| A5 | Stopping a server degrades instead of crashing | **not implemented** | Nothing calls the server yet. |
| A6 | A new agent needs zero changes under `apps/web` | **not implemented** | The registry is an empty map; nothing registers. |
| A7 | Changing the LLM channel changes no application code | **not implemented** | No model exit yet; Prompt 5. |
| A8 | Every stage is visible before the answer completes | **not implemented** | No stages yet. |

## Verified at this stage

| Claim | Evidence |
|---|---|
| Real MCP over Streamable HTTP | `npm run smoke` — initialize, tools/list, tools/call |
| Real MCP over stdio | `npm run smoke:stdio` — the transport Claude Desktop uses |
| A smoke script that can fail | `npx tsx scripts/smoke-mcp.ts http://localhost:3999/mcp` exits 1 |
| Capabilities are earned | `initialize` reported `{}` at Prompt 2 and reports `tools` now |
| A miss is structured | `find_employee` with an unknown name returns `{"status":"not_found",...}` |
| Types and units | `npm run typecheck` clean, 7 tests pass |
