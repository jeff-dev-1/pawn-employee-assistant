# PRD — PAWN Employee Assistant

## 1. Target users and core scenarios

| User | Scenario |
|---|---|
| New hire | "What is the remote work policy?" — needs the handbook, not a colleague |
| Existing employee | "How many vacation days do I have left?" — needs their own record |
| Existing employee | "Who is my manager, and what tickets have I opened?" — **spans HR and IT** |
| IT support | "Which tickets are still unassigned?" — needs the ticket queue |

The third row is the reason this system exists. It cannot be answered from one data domain.

## 2. MVP boundary

**In scope**: natural-language questions over three domains; automatic domain selection;
concurrent retrieval; one composed answer; visible progress.

**Out of scope**: multi-turn conversation memory; authentication and per-user access control;
writes of any kind (no ticket creation, no leave requests); vector retrieval; more than
English; running against a locally hosted model.

## 3. Product-level data flow

```
employee question
  -> the system decides which domains hold the answer
  -> those domains are consulted at the same time
  -> the findings are composed into one answer that cites what it used
  -> if a domain is unavailable, the answer says so instead of guessing
```

## 4. Acceptance criteria

| # | Criterion | How it is observed |
|---|---|---|
| A1 | One command starts the whole system; all processes healthy within 30 seconds | `npm run dev`, then four health endpoints return 200 |
| A2 | The system answers a single-domain question using exactly one domain | ask a vacation question; the log shows one tool call |
| A3 | The system answers the cross-domain question using two domains concurrently | ask the manager/tickets question; the log shows two servers called in parallel |
| A4 | An unanswerable question is refused, not guessed | ask about something no domain holds; the answer declines |
| A5 | Stopping any single server degrades the answer instead of crashing | stop one server, ask the cross-domain question, get a partial answer that names what is missing |
| A6 | Adding a new agent requires zero lines changed under `apps/web` | `git diff --stat apps/web` is empty after adding one |
| A7 | Changing the LLM channel changes no application code | flip `LLM_PROVIDER` between `portkey` and `direct`, ask the same question, then `git diff --stat` is empty |
| A8 | Every stage is visible to the user before the answer completes | the UI shows plan, execution, and answer as separate events |

## 5. Risks and open questions

| Risk | Mitigation |
|---|---|
| The planner emits malformed JSON | Schema validation with one retry, then an explicit refusal. With no server-side schema enforcement a malformed plan is normal traffic, not an anomaly |
| Conference-room network fails during the demo | Every model call is a public cloud call, so there is no offline path. Mitigation is operational: a second channel (`direct`) that does not depend on the gateway, a phone hotspot, and a recorded run of the test cases as a last resort. |
| A slow server stalls the whole answer | Per-call timeout; `execute` continues with what returned |
| The planner routes to the wrong domain | Empty `calls` beats a wrong default; A4 tests it |

| The planner cannot chain tool results | Single-shot planning is a stated limit, not a defect. Questions whose second half depends on the first half's answer ("who else reports to my manager") are out of scope for the MVP; a tool loop would be required. Note the limit does not always show as a refusal: where over-fetching can substitute for chaining, the planner will over-fetch and let synthesis do the join, which works only while the over-fetched set fits in the context window. |

Open: whether a per-call timeout belongs in `execute` or in the MCP client.
