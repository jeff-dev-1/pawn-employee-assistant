# Test Cases

Read these aloud in class. Each states an input and what should happen.

## Routing

| # | Ask | Expected |
|---|---|---|
| 1 | How many vacation days do I have left? | HR only. One tool call: `hr.find_employee`. |
| 2 | What is the status of ticket T-1001? | IT only. One tool call: `it.get_ticket`. |
| 3 | **Who is my manager, and what tickets have I opened?** | **HR and IT concurrently.** Two tool calls, one composed answer naming Tomas Berg and three tickets. |
| 4 | When is the company holiday party? | Empty plan. The assistant declines instead of guessing. |

Case 3 is the one a single-agent system cannot serve. Ask 1, 2, 3 back to back so the room
sees the planner deciding for itself whether to split.

## The limit of single-shot planning

| # | Ask | Expected |
|---|---|---|
| 5 | Who else reports to my manager? | **Refuses, correctly** — 7 runs, 7 refusals. Either an empty plan, or `find_employee` alone followed by "your manager is Tomas Berg, but I cannot tell you who else reports to him". `get_team` needs a name only the first call can supply. Say this out loud; it is why appendix A exists. |
| 5b | Which tickets is my manager waiting to approve? | **Usually answered, and that is the more interesting result** — 7 runs: 1 refusal, 6 correct answers reached by fetching every `awaiting_approval` ticket and joining in synthesis. Single-shot planning substitutes over-fetching for chaining; it works while the fetched set fits in the context window, and degrades silently when it stops fitting. Do not promise the room a refusal here. |

## Degradation

| # | Do this | Expected |
|---|---|---|
| 6 | `kill $(lsof -ti:3102)`, then ask case 3 | The HR half is answered; the reply states that ticket information is unavailable. No 500. |
| 7 | `curl -s localhost:3000/api/health` after case 6 | `it` is absent or marked unreachable. |

## Channel switching

| # | Do this | Expected |
|---|---|---|
| 8 | Ask case 1 on `LLM_PROVIDER=portkey`, then again on `LLM_PROVIDER=direct` | Same answer through both channels. |
| 9 | `git diff --stat` after case 8 | Empty. Changing vendor and channel changed no code. |
| 10 | Open the Portkey dashboard after case 8 | The gateway run is listed with latency, tokens and cost; the direct run is not. That gap is what the gateway is for. |
| 11 | `PLANNER_VENDOR=deepseek WRITER_VENDOR=moonshot npm run dev`, ask case 3 | Two vendors serve one answer. Picking a model per task is a config line, not a refactor. |

## Architecture

| # | Do this | Expected |
|---|---|---|
| 12 | Add `servers/policy`, restart, ask "What is the remote work policy?" | Answered. `git diff --stat apps/web` is empty. |
