# Test Cases

Cases the instructor reads aloud. Each has an input and an expected result.

## Routing

| # | Ask | Expected |
|---|---|---|
| 1 | How many vacation days do I have left? | HR only. "22 days remaining out of 25." |
| 2 | What's the status of my laptop ticket? | IT only. The laptop tickets, with status and assignee. |
| 3 | Who is my manager, and what tickets have I opened? | HR **and** IT, called concurrently, one composed answer naming Tomas Berg and the tickets. |
| 4 | What is the remote work policy? | Policy only. Three days remote, two in the office. |

Ask 1–3 back to back so the room sees the planner deciding for itself whether to split.

## Refusal

| # | Ask | Expected |
|---|---|---|
| 5 | When is the company holiday party? | Empty plan, explicit refusal, nothing invented. |
| 6 | Who else reports to my manager? | **Refuses, correctly.** `get_team` needs a manager name only the first call can supply, and there is no over-fetch that produces one. Either an empty plan, or `find_employee` alone and "I could not answer who else reports to him". |
| 6b | Which tickets is my manager waiting to approve? | **Usually answered, and that is the more interesting result.** The planner over-fetches every `awaiting_approval` ticket and lets synthesis do the join. Do not promise the room a refusal here. |

## Degradation

| # | Do this | Expected |
|---|---|---|
| 7 | `kill $(lsof -ti:3102)`, then ask case 3 | The HR half is answered and the missing half is named. No 500. |
| 8 | `curl -s localhost:3000/api/health` ~50s later | `"status":"degraded"`, with `it` marked `stale`. |

## Channel and architecture

| # | Do this | Expected |
|---|---|---|
| 9 | Flip `LLM_PROVIDER` between `portkey` and `direct`, ask case 1 again | The same answer. `git diff --stat` empty. |
| 10 | `git diff --stat apps/web` after adding the policy server | Empty. |
