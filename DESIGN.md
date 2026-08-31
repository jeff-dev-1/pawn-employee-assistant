# Design — Employee Assistant

## 1. The four processes

| Process | Port | Responsibility |
|---|---|---|
| `apps/web` | 3000 | UI and orchestrator. Plans, calls MCP servers concurrently, synthesizes one answer. The only process that talks to a model. |
| `servers/hr` | 3101 | HR data domain. Employee records from a CSV. Tools only, no reasoning. |
| `servers/it` | 3102 | IT data domain. Ticket records from SQLite. Tools only, no reasoning. |
| `servers/policy` | 3103 | Policy domain. Markdown handbook, keyword search. Tools only, no reasoning. |

Each server registers itself with the orchestrator at startup and re-announces on a
heartbeat. The orchestrator pulls `tools/list` into an in-memory registry, so adding a
server requires no change under `apps/web`.

## 2. Agent → MCP tool mapping

Every tool implemented anywhere in this project must appear as a row here first.

| Server | Tool | Arguments | Returns |
|---|---|---|---|
| hr | `find_employee` | `name?: string`, `email?: string` | one employee record, or `not_found` |
| hr | `get_team` | `manager: string` | the direct reports of that manager, or `not_found` |
| it | `list_tickets` | `assignee?`, `approver?`, `status?` | matching tickets, possibly empty |
| it | `get_ticket` | `id: string` | one ticket, or `not_found` |
| policy | `search_policy` | `query: string` | matching excerpts with their document titles |

## 3. The orchestrator pipeline

```
question
  ├─ ① plan       1 LLM call, schema-constrained: { calls: [...], reasoning }
  ├─ ② execute    0 LLM calls, Promise.allSettled over the planned calls
  └─ ③ synthesize 1 LLM call, streamed: question + tool results -> one answer
```

Two LLM calls per question, no matter how many domains are involved.

## 4. Error handling rules

1. A tool that finds nothing returns a structured `not_found`. It never throws and never
   returns an apology sentence — natural language is the orchestrator's job.
2. Concurrent calls use `Promise.allSettled`. A failed call is recorded as an outcome and
   passed to synthesis; it does not abort the batch.
3. Synthesis must name what it could not retrieve. It never fakes completeness.
4. If the planner produces nothing usable, `calls` is empty and the system refuses. It never
   falls back to a default server: a routing error must not become a silently wrong answer.
5. A missing configuration value fails immediately with a message naming the variable.

## 5. LLM access

`apps/web/lib/llm.ts` is the only file allowed to import a model SDK. One provider factory,
switched by `LLM_PROVIDER`: through a gateway, or straight to a vendor. Two model roles —
a planner judged on stable JSON, a writer judged on prose — each able to name its own vendor.
