# PRD — Employee Assistant

## 1. Target users and core scenarios

| User | Scenario |
|---|---|
| New hire | "What is the remote work policy?" — needs the handbook, not a colleague |
| Existing employee | "How many vacation days do I have left?" — needs their own record |
| Existing employee | "Who is my manager, and what tickets have I opened?" — **spans HR and IT** |
| IT support | "Which tickets are still unassigned?" — needs the ticket queue |

The third row is the reason this system exists. It cannot be answered from one data domain,
and its two halves are independent, so both can be retrieved at the same time.

## 2. MVP boundary

**In scope**: natural-language questions over three data domains; automatic domain selection;
concurrent retrieval; one composed answer; visible progress while the answer is produced.

**Out of scope**: multi-turn conversation memory; authentication and per-user access control;
writes of any kind (no ticket creation, no leave requests); vector retrieval; any language
other than English; running against a locally hosted model.

## 3. Product-level data flow

```
employee question
  -> the system decides which data domains hold the answer
  -> those domains are consulted at the same time
  -> the findings are composed into one answer that uses only what was retrieved
  -> if a domain is unavailable, the answer says which part it could not answer
```

## 4. Acceptance criteria

| # | Criterion | How it is observed |
|---|---|---|
| A1 | One command starts the whole system; every process reports itself healthy within 30 seconds | start it with one command, then read each process's health report |
| A2 | A single-domain question consults exactly one domain | ask about remaining vacation days; the trace shows one retrieval |
| A3 | The cross-domain question consults two domains at the same time | ask the manager-and-tickets question; the trace shows two domains retrieved in parallel |
| A4 | An unanswerable question is refused, not guessed | ask about something no domain holds; the reply declines and invents nothing |
| A5 | Stopping any single data domain degrades the answer instead of crashing the system | stop one domain, ask the cross-domain question, receive the surviving half plus a statement of what is missing |
| A6 | Adding a new data domain requires zero lines changed in the orchestrator | add one, then confirm the orchestrator's source is byte-for-byte unchanged |
| A7 | Changing the model channel changes no application code | switch the channel, ask the same question, then confirm the source is unchanged |
| A8 | Every stage is visible to the user before the answer completes | the interface shows domain selection, retrieval, and answer as separate events |

## 5. Risks and open questions

| Risk | Mitigation |
|---|---|
| The planner emits output that does not match the required structure | Validate, retry once, then refuse explicitly |
| The planner routes to the wrong domain | An empty selection beats a wrong default; A4 tests it |
| A slow domain stalls the whole answer | Per-call timeout; the answer is composed from what returned |
| The conference network fails during a demo | Every model call is a public cloud call, so there is no offline path. A second channel, a phone hotspot, and a recorded run are the operational mitigations |
| The planner cannot chain retrievals | One planning pass means the second half of a question cannot depend on the first half's answer. "Who else reports to my manager?" is out of scope for the MVP. Where over-fetching can substitute for chaining the planner will over-fetch instead, which works only while the over-fetched set still fits in the context window |

Open: whether a per-call timeout belongs in the orchestrator's retrieval stage or in its
protocol client.
