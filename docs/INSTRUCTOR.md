# Instructor Runbook

> This is not for students. It is what you work from **while the room is watching**.
> The prompt text, the acceptance commands and the decision cards live in
> [`BUILD-FROM-ZERO.md`](./BUILD-FROM-ZERO.md); this file carries only **pacing, phrasing,
> and what to do when something goes wrong**. The two do not repeat each other.
>
> One numbering scheme: **Prompts 0–11**, matching tags `prompt-0` … `prompt-11`.
>
> **Language**: everything is English — this file, the manual, the prompts students paste,
> the demo data, the UI, the code comments. Speak whatever language the room speaks, but
> everything on the screen is English, because the screen is what they copy.

---

## Thirty minutes before class (not optional)

```bash
# 1. Clean state
cd ~/Documents/workspace/pawn-employee-assistant
git status                       # must be clean
git checkout main

# 2. Pre-flight both cloud channels. There is no local model, so a dead network has no plan B
LLM_PROVIDER=portkey npm run check-llm
LLM_PROVIDER=direct  npm run check-llm

# 3. Confirm the Portkey dashboard opens - Prompt 5's set piece is shown live from it

# 4. Full run
make demo && sleep 30 && npm run smoke && make down

# 5. The guardrail still denies, and normal questions still answer
npm run guardrail                # injection must come back 446
npm run dev                      # then ask all four demo questions

# 6. Rehearse the Claude Desktop registration (Prompt 4's set piece)
#    Use servers/hr's stdio entry, not HTTP - Desktop's config only accepts stdio
#    Quit Claude Desktop completely and relaunch, or it will not reload the config

# 7. The planted bug for Prompt 10 already exists at tag prompt-10-bug.
#    Check it out once so you know what the room will see:
git checkout prompt-10-bug && git checkout main

# 8. Read this file end to end, out loud
```

**Step 8 is not ceremony.** Twice now, something wrong in this repository was caught by
being forced to read a file line by line — once while translating it, once while rehearsing
it — and neither time by a grep written specifically to catch it. A scanner finds what you
told it to look for. Reading finds what you did not know to look for, and it is the only
technique here with that property.

**Steps 5, 6 and 7 have to be done before the room fills up.** Fixing a bug live gives the
game away: if students watch you create the problem, the step teaches nothing.

---

## Timeline (180 minutes)

| Time | Prompt | Topic | Mode | The move that matters |
|---|---|---|---|---|
| 0:00 | — | Opening: what each demo is for | talk | Against Demo 1: that one teaches governance, this one teaches orchestration |
| 0:05 | 0 | Context Stack | live | **Let the AI run ahead on purpose**, and interrupt it in front of everyone |
| 0:15 | 1 | PRD | live | Say "no" out loud, and show requirements being narrowed |
| 0:25 | 2 | Scaffold | live | Hold back the urge to add the LLM |
| 0:40 | 3 | HR tools + unit tests | live | Send the AI to read the SDK's type definitions |
| 1:00 | 4 | **Protocol-level acceptance** | live | Paste it into Claude Desktop and ask a question |
| 1:15 | — | Break | | |
| 1:25 | 5 | The model exit | live | **Flip the channel, then show them the empty row in the Portkey dashboard** |
| 1:35 | 6 | The planner | live | Show the raw plan in the debug log |
| 1:55 | 7 | Second agent + synthesis | live | Three questions back to back, then the fourth for the limit |
| 2:15 | 8 | SSE | live | |
| 2:25 | 9 | **Students build an agent** | students | Walk the room. Do not shorten this |
| 2:40 | 10 | AI debugging | live | Make the model explain before it touches anything |
| 2:55 | 11 | Ship it | live | Read the line count out loud (2400, comments and blank lines excluded) |
| 3:00 | | Close | | |

---

## Five set pieces (remember these; everything else is setup)

1. **The interruption in Prompt 0** (1 minute)
   The AI starts writing code. You cut it off: "You violated the requirement: output a plan
   first." Students need to see what pulling back a runaway model looks like, not only a
   demo where everything went smoothly.

2. **Prompt 4 into Claude Desktop** (30 seconds)
   Paste the registration JSON — **the stdio one** — into your own Claude Desktop, quit and
   relaunch completely, and ask "Who is Dana Reeve's manager?". The thing they just built is
   being called by a real host. That moment is worth half an hour of explanation.

3. **Prompt 5, flipping the channel** (30 seconds)
   Change `LLM_PROVIDER` from `portkey` to `direct`. Same question, same answer, not one line
   of code changed. Then open the Portkey dashboard: the gateway call is sitting there with
   latency, tokens and cost attached, and the direct call is **nowhere**. Make the room look
   at that empty row for three seconds — **you did not buy a better answer, you bought the
   ability to see it, price it, cap it and block it.** This beats ten slides on gateways.

4. **Prompt 7: three questions, then a fourth** (3 minutes)
   Single domain → single domain → cross-domain, so the room watches the planner **decide for
   itself** whether to split, with no hard-coded rules. Then ask
   **"Who else reports to my manager?"** — it refuses (measured: 7 runs, 7 refusals), because
   `get_team` needs a manager name that only the first call can supply and there is no
   list-everybody tool to work around it. **Admit the limit out loud**; it is the reason
   appendix A exists.

   > **Do not use "Which tickets is my manager waiting to approve?" for this.**
   > Measured, it was answered — correctly — in 6 runs out of 7: the planner fetches every
   > `awaiting_approval` ticket and lets the writer do the join in the context window.
   > Single-shot planning does not fail at chaining, it **substitutes over-fetching for
   > chaining** — which holds while the fetched set still fits, and degrades **silently** on
   > the day it does not. That fact is worth more than "it fails", but it is not something to
   > bet on in front of a room. Ask the one that refuses reliably.

5. **`git diff apps/web` is empty in Prompt 9** (10 seconds)
   The students have just added the third agent. Type the command in front of them. Empty
   output is the architecture's mark.

---

## Assertions that expire

Four of the things this course demonstrates are not properties of this code. They are
observations about systems outside this repository, made on one day, and they can stop being
true without anything here changing.

| Assertion | What it actually depends on | Re-check |
|---|---|---|
| "Who else reports to my manager?" refuses — 7 runs, 7 refusals | one model version's planning behaviour | ask it twice |
| "Which tickets is my manager waiting to approve?" is answered 6 times in 7 | the same | ask it twice |
| The injection probe returns **446** | the AIRS profile, the guardrail, the config, and the key behind them | `npm run guardrail` |
| The four demo questions do not trip the guardrail | that profile's sensitivity to employee records | `npm run dev`, ask all four |

`scripts/verify-tags.sh` cannot cover any of these. It checks that this code still does what
this code did; these are claims about somebody else's system, and no test in this repository
can hold them.

The failure mode is specific, and it is not a crash. **The demo does not break — it
contradicts you.** You tell the room the planner refuses this question and it answers
confidently. You tell them the gateway blocks this and a cheerful reply comes back.
Recovering from that live costs far more than the four minutes it takes to run the four
commands above.

Run them the morning of the session, not the week before.

---

## What goes wrong, and what to do

| Symptom | What to do |
|---|---|
| The AI runs ahead and writes code | Interrupt, restate "plan first". **Let it happen once on purpose**; it will not happen again |
| The MCP SDK's API is not what the model remembers | Send it to read the type definitions under `node_modules/@modelcontextprotocol/sdk` |
| Portkey answers 401 or rate-limits | One line to `LLM_PROVIDER=direct` — which is set piece 3 arriving early |
| The direct channel is down too (vendor outage) | Switch `PLANNER_VENDOR` / `WRITER_VENDOR` to another vendor. Three keys exist for exactly this |
| The room has no network | **There is no plan B.** Prompts 0–4 need none, so carry on; from Prompt 5, demo against the standing instance, or read the recorded results out of `TEST-CASES.md` |
| The planner's JSON is unstable | Change `PLANNER_VENDOR`. The planner is judged on stable JSON, not on prose |
| The planner's output does not match the schema | This is **normal traffic, not a fault.** Show the retry, and say why it refuses instead of falling back to a default agent |
| The limit question gets answered | "7 runs, 7 refusals" is a statistical claim about a non-deterministic system, true of one model on one day. **Ask Prompt 7's fourth question and case 5b twice before every cohort**; swap the question if it no longer holds. Do not find out live |
| A student is stuck on Prompt 9 | `git checkout prompt-9`. Nobody stalls |
| The AI produces comments or errors in another language | The student's prompt is contaminated. Check whether they asked a follow-up in that language — `CLAUDE.md` already pins English only |
| Twenty minutes behind | Cut in the order below |

---

## What to cut, in order (you will run out of time)

1. **Appendices A and B** (`ToolLoopAgent`, the guardrail) → two sentences, spoken, and move on
2. **Prompt 8 (SSE)** → show the finished result instead of writing it live. It looks good, but it does not change the architecture
3. **Prompt 10 (AI debugging)** → compress to 8 minutes, keeping only the "explain before you touch it" exchange
4. **Never cut the student time in Prompt 9.** The fifteen minutes students spend building an agent themselves leave more behind than forty-five minutes of watching you

---

## What students need beforehand

Send this out and have them install it **before** the session:

```bash
node -v          # needs >= 20.9 (Next 16's floor)
git --version
docker --version # only for Prompt 11's make demo; npm run dev covers it otherwise
```

Claude Code signed in and working. **Hand out the API key on the day**: Prompts 0–4 need no
key, so give it out at the break, and it is first used in Prompt 5.
