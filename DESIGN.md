# PAWN Employee Assistant · Design

> **Status**: built and verified. A1–A8 all pass; see `docs/ACCEPTANCE.md`.
> **Purpose**: **Demo 2** of the PAWN Vibe Coding training. Demo 1 (`vibe-coding/demo`) is the
> AI Log Analysis Platform and teaches the **AI Harness**: gateway, guardrails, structured
> output, red-teaming, supply-chain gating.
> This demo teaches a different thing: **agent orchestration** — the MCP protocol,
> multi-agent routing, tools and resources, capability self-registration.
> The two demos are fully independent repositories and share no code.
>
> **Language**: all student-facing material is English — this document, the build manual,
> the prompts students paste into Claude Code, the demo data, and the UI.
> `docs/INSTRUCTOR.md` is the only Chinese document; it is the instructor's own runbook.

---

## 1. What this demo is

An internal employee assistant. An employee asks a question in natural language; the system
decides which data domains to consult, fetches concurrently, and composes one answer:

| Question | What the system does |
|---|---|
| "How many vacation days do I have left?" | Route to HR → read employee record → answer |
| "What's the status of my laptop ticket?" | Route to IT → query ticket DB → answer |
| "Who is my manager, and what tickets have I opened?" | Route to HR **and** IT → fetch concurrently → compose one answer |
| "What is the remote work policy?" | Route to Policy → search the handbook → answer with the clause |

That third row — cross-domain composition — is the point of the demo, and the one thing a
single-agent system cannot do.

**All demo data is fictional** (a made-up company, Acme Corp: employees, tickets, policies).
PAWN is the real company whose employees attend the training; no real employee data goes
into the repository.

---

## 2. Architecture

Four processes, all on the local machine:

```
┌─────────────────────────────────────────────┐
│  apps/web  :3000   Next.js 16 (App Router)  │
│  ├─ Frontend: React + Tailwind, SSE stages  │
│  └─ Orchestrator: MCP client + LLM calls    │
└──────────────────┬──────────────────────────┘
                   │  MCP Streamable HTTP
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 servers/hr   servers/it   servers/policy
   :3101        :3102         :3103
 employees.csv  tickets.csv  policies/*.md
                (in-memory
                 SQLite)
```

Plus one LLM exit: the orchestrator talks to the **Portkey gateway** or **directly to a
vendor**, switched by a single environment variable. Both are public cloud; there is no
locally hosted model.

> Rendered diagram: `docs/diagrams/architecture.png`. The DiagramSpec source is the `.yaml`
> next to it — edit the YAML and re-render; never hand-edit the SVG.

### 2.1 The one big change from the reference project

Everything in this section was measured against
[`PaloAltoNetworks/demo-local-ai-hr-it-bot`](https://github.com/PaloAltoNetworks/demo-local-ai-hr-it-bot)
by cloning it. **Pin the ref when you quote a number about somebody else's repository** — this
one moves, and the comparison below stopped being a contrast while nobody was looking:

| Ref | Date | State |
|---|---|---|
| `main` = `02ecd06` | 2026-04-03 | What this section describes. Three agent servers, each calling the LLM. |
| `v.0.1.0` | 2026-07-09 | 129 commits on. Restructured into `agents/` and `chatbot-v2/`. |
| `feat/ai-elements-ui` = `547613e` | 2026-08-28 | 187 commits on. **See §2.1.1 — it converged on this design.** |

In that reference project, **every agent calls the LLM itself**. `mcp-server/shared/query-processor.js`
calls `LLMProviderFactory.generateText` and is used by all three agent servers — `hr-mcp-server`,
`it-mcp-server` and `general-mcp-server`. One cross-domain question costs **4–6 LLM calls**,
and the range is not vague — it is two optional hops, both of which this demo cuts:

| Step | `mcp-gateway/coordinator.js` | Calls |
|---|---|---|
| Route | `analyzeRoutingStrategy` :590 | 1 |
| Each agent answers its sub-query | `queryAgent` :808, :840 → `query-processor.js` :24 | +2 |
| Synthesize | `synthesizeMultiAgentResponses` :864 | +1 → **4** |
| Validate the answer is on topic | `generateWithLLM(validationPrompt)` :1076 | +1 → 5 |
| Translate, when the language is not English | `translateResponse` :1118 | +1 → **6** |

This demo inverts that: **MCP servers are pure data/tool layers with no LLM inside.**
All reasoning lives in the orchestrator.

| | Reference project | This demo |
|---|---|---|
| Agent responsibility | Own system prompt, own LLM calls | Expose MCP tools / resources only |
| LLM calls per cross-domain query | 4–6 | **2** (one plan + one synthesis) |
| Cost and latency per question | 4-6 paid round trips | 2 |
| Faithful to MCP's design intent | No — servers do the reasoning | Yes — servers provide capability, the host reasons |

Three reasons, in order of weight:

1. **Teaching.** It makes "which step uses the LLM" answerable. In the reference project the
   LLM calls are scattered across four processes and students lose the thread.
2. **The room.** Every call is a paid public-cloud round trip. Six of them per question is
   three times the latency and three times the bill, live, in front of an audience that is
   watching a spinner. Two is a demo; six is an apology.
3. **The protocol.** An MCP server is supposed to be a capability provider. The reference
   repository once had an `it-tools-mcp-server` (pure tools, no LLM, for external LLM hosts)
   which was later removed — this demo makes that direction the main line.

The cost, stated plainly: agents lose their domain-specific system prompts. The compensation
is to put domain knowledge into MCP tool `description` fields and resources so the planner
can read it — which is the correct use of MCP anyway, and a teaching point in its own right.

### 2.1.1 The reference project reached the same four conclusions

Do not present §2.1 as "what we did differently" without reading this first. On
`feat/ai-elements-ui` (`547613e`, 2026-08-28, 187 commits past the `main` measured above),
the reference project has independently arrived at the same decisions:

| Decision | This demo | Reference at `feat/ai-elements-ui` |
|---|---|---|
| MCP servers hold no LLM | 3 servers, 0 model calls | `hr-tools-mcp-server` and `it-tools-mcp-server`, **0 of 10 JS files call a model** |
| One model exit through a gateway | `lib/llm.ts`, Portkey, OpenAI-compatible | LLM via Portkey, `api.portkey.ai/v1`, OpenAI-compatible |
| Guardrails configured, not hand-written | appendix B | hand-written Prisma AIRS call sites gone; a gateway guardrail with a trace link and token count |
| Streamed markdown in the UI | `streamdown` | `streamdown`, `ai`, `@ai-sdk/react`, `lucide-react` |

Two teams, no shared code, four matching conclusions. **That is a better argument for this
architecture than the contrast in §2.1 ever was**, and it is the honest way to present it:
this demo is not a correction of that project, it is the same conclusion reached from the
other end, with the reasoning left visible because the reasoning is the lesson.

What still differs is the shape of the reasoning layer. The reference project keeps one
`it-triage-agent` that calls a model of its own; this demo puts every model call in the
orchestrator, which is what makes "which step uses the LLM" answerable in a classroom.

### 2.2 The orchestrator pipeline

One question moves through three stages. Each stage pushes an SSE event so students can
*see* the system think:

```
User question
   │
   ├─ ① PLAN       1 LLM call (structured output)
   │               in:  question + tool catalog from all registered servers
   │               out: { calls: [{ server, tool, args }], reasoning }
   │               → SSE: "needs HR employee record + IT ticket list"
   │
   ├─ ② EXECUTE    0 LLM calls
   │               concurrent MCP tool calls, pure data
   │               → SSE: "hr.find_employee 42ms · it.list_tickets 88ms"
   │
   └─ ③ SYNTHESIZE 1 LLM call (streamText)
                   in:  question + tool results
                   out: streamed answer
                   → SSE: token by token
```

**What single-shot planning cannot do**: the planner gets one pass, so it cannot feed one
tool's result into another tool's arguments. *"Who else reports to my manager?"* needs the
manager's name before `get_team` can be called, and there is no over-fetch that produces one,
so it refuses — correctly, and reliably (7 runs, 7 refusals).

Where an over-fetch *is* available the limit hides itself: asked *"which tickets is my
manager waiting to approve?"*, the planner fetches every `awaiting_approval` ticket and lets
synthesis do the join, answering correctly in 6 of 7 runs. Single-shot planning substitutes
**over-fetching plus a join in the context window** for chaining. That holds while the
over-fetched set fits, and degrades silently when it stops fitting — which is why the
reliable demonstration uses the first question and not the second.
This is a stated limit, not a defect, and it is the reason appendix A exists: a tool loop
re-plans after every result and handles exactly this. Measured against this codebase it
costs three LLM calls where the pipeline spends two, and roughly twice the input tokens,
because every step re-sends the whole tool catalog.

**Teaching design**: students hand-write these three stages (Prompts 6–7), then swap them for
the AI SDK's `ToolLoopAgent` in the appendix. Doing it by hand first is what makes the
framework's cost visible — and the measurement corrects the guess most rooms make. On a
single-hop question both spend exactly **two** LLM calls; the difference is **tokens**
(the loop re-sends the catalog every step) and the **loss of the planner/writer split**,
which the framework does not remove so much as hide. See appendix A for the numbers.

### 2.3 Capability self-registration

Each MCP server registers with the orchestrator at startup
(`POST /api/agents/register`: name, URL, capability blurb). The orchestrator pulls its
`tools/list` into an in-memory registry and refreshes on a heartbeat.

So **adding an agent requires no change to the orchestrator**. Prompt 9 has students add the
third agent themselves to prove it — the acceptance test is that `git diff apps/web` is empty.

---

## 3. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Types are the contract; type errors are the best feedback signal for AI-generated code |
| Frontend + orchestrator | Next.js 16 App Router | One process for UI and API; Route Handlers stream natively |
| Styling | Tailwind v4 + `lucide-react` icons | No hand-written CSS file, no component library to learn. The two UI components are 60 lines each |
| MCP | `@modelcontextprotocol/sdk` (official TS SDK) | Use the real protocol, do not hand-roll JSON-RPC |
| MCP transport | **Streamable HTTP** (+ a stdio entry point) | The SSE transport is deprecated; stdio is still required for Claude Desktop (see §3.2) |
| LLM calls | Vercel AI SDK (`ai` + `@ai-sdk/openai-compatible`) | The gateway and every direct vendor are OpenAI-compatible; one provider factory covers all of them |
| HR data | CSV (`employees.csv`) | Students can read and edit it without tooling |
| IT data | SQLite (`better-sqlite3`) | Real SQL, zero external dependencies |
| Policy data | Markdown files + keyword search | Deliberately **no vector store**: a dozen documents fit in the context window |
| Process orchestration | npm workspaces + `concurrently` | `npm run dev` starts four processes |
| Delivery | docker compose + Makefile | Matches Demo 1's `make demo` habit |

### 3.1 Pinned versions

Verified against the npm registry on 2026-08-31. The model's training data lags the registry,
so these are stated here and re-checked before each cohort:

| Package | Version | Note |
|---|---|---|
| `next` | 16.3.3 | requires Node >= 20.9 |
| `@modelcontextprotocol/sdk` | 1.30.0 | |
| `ai` | 7.0.85 | AI SDK v7; the v5 API differs substantially |
| `@ai-sdk/openai-compatible` | 3.0.41 | |
| `zod` | 4.5.4 | |

When the model writes an API that does not typecheck, the fix is to read the type definitions
under `node_modules/`, never to guess a different call shape.

### 3.2 Deliberately out of scope

Everything cut is something in the reference project whose engineering weight exceeds its
teaching value:

- **Nine-language i18n** (ar, de, en, es, fr, it, ja, pt, zh) → English only. On `main` the
  locale files are 1 653 of 15 419 lines, about 11%; on the newer `v.0.1.0` branch they are
  2 977 of 14 177, about 21%. Earlier drafts of this document said "close to a fifth" without
  naming a ref, which was true of one branch and not the other.
- **phase1/2/3 run modes** → one mode.
- **Dual LLM provider implementations (LiteLLM + standard)** → one provider factory.
- **Twelve hand-written frontend modules** (the reference `chat-handler.js` is 1109 lines
  in one file) → React components.
- **The response-validation hop** (an LLM judging whether another LLM's answer was on topic)
  → removed. It costs a round trip and almost never fires at demo scale.
- **Vector retrieval / RAG** → Demo 1 already covers it; no reason to repeat it here.

Target size: **about 1500 lines of TypeScript**, buildable from zero in three hours, with
something runnable at the end of every step.

### 3.3 Two transports, one capability

Each MCP server exposes the same tool registry over two transports:

- `src/server.ts` — Streamable HTTP on its own port, used by the orchestrator.
- `src/stdio.ts` — stdio, used by Claude Desktop.

This is not a compromise. Claude Desktop's `claude_desktop_config.json` accepts stdio servers
only; pasting an HTTP URL there is silently ignored and can drop the whole `mcpServers` block
on the next save. The orchestrator, meanwhile, needs HTTP because it talks to separate
processes. `stdio.ts` is about a dozen lines — which is exactly the point: transport and
business logic are separable.

---

## 4. LLM access: gateway or direct, always public cloud

`apps/web/lib/llm.ts` is the **only** file allowed to import a model SDK. Business code knows
no vendor.

```
LLM_PROVIDER=portkey  → https://api.portkey.ai/v1
                        headers: x-portkey-api-key / x-portkey-virtual-key
                        every vendor behind one gateway
LLM_PROVIDER=direct   → https://api.deepseek.com/v1                       DEEPSEEK_API_KEY
                        https://api.moonshot.cn/v1                        MOONSHOT_API_KEY
                        https://dashscope.aliyuncs.com/compatible-mode/v1 DASHSCOPE_API_KEY
```

Both are OpenAI-compatible, so this is **one provider factory with a different baseURL and
headers**, not two implementations.

The two channels are not a fallback pair; they are the argument. Both return an answer. Only
the gateway run shows up with latency, tokens, cost, retries and guardrails attached. You did
not buy a different answer — you bought the ability to see, price, cap and guard the call.
Demonstrating that gap is the point of §4.1 and of Prompt 5.

### 4.1 Two model roles

| Role | Job | What it needs | Default vendor | Env |
|---|---|---|---|---|
| `MODEL_PLANNER` | Plan: emit structured tool calls | Stable JSON > prose | DeepSeek | `PLANNER_VENDOR` / `MODEL_PLANNER` |
| `MODEL_WRITER` | Synthesize: write the employee-facing answer | Good prose | DeepSeek, Kimi or Qwen | `WRITER_VENDOR` / `MODEL_WRITER` |

Each role names its own vendor, so one answer can be planned by one model and written by
another. On the `direct` channel the vendor selects a base URL and key; on the `portkey`
channel it selects a virtual key.

Splitting the roles is not only about cost. It makes **"pick a model for the task"** a thing
that exists explicitly in the code, instead of one hard-coded model name everywhere.

### 4.2 Portkey and Prisma AIRS

Portkey was acquired by Palo Alto Networks in May 2026 and is now the gateway for Prisma AIRS.
At `main` the reference project integrates Prisma AIRS directly. `mcp-gateway/prisma-airs.js`
wraps the API, and `coordinator.js` runs **four named checkpoints** — user input, outbound
sub-query, inbound response, final response (`CHECKPOINT 1`–`4` at :1491, :934, :1008, and
:1600/:1657 — five call sites, because checkpoint 4 appears on both the single-agent and
multi-agent paths). All four funnel through one helper, `_analyzeSecurityCheckpoint` :1239,
which calls the AIRS client at **two** places: `analyzePrompt` :1274 and
`analyzePromptAndResponse` :1282. Two API shapes serving four policy points.

The point is not the number: those checkpoints are hand-written into the application, so the
fifth one is the one somebody forgets.

By `feat/ai-elements-ui` those hand-written call sites are gone and the same job is done by a
gateway guardrail. **The reference project made this move too** — which makes appendix B a
demonstration of where the industry went, not a claim about where it should go.

That contrast — the same governance requirement written into business code versus configured
at the gateway — is appendix B.

### 4.3 There is no offline path

Every model call goes to a public endpoint. This is a deliberate simplification — a local
model doubles the student prep, costs gigabytes of download in a conference room, and turns
"the planner emits stable JSON" into a property of a 3B model rather than of the design.

The consequence has to be planned for, not discovered on the day:

- Prompts 0–4 need no key and no internet. **The guaranteed takeaway survives a dead network.**
- From Prompt 5 the room needs connectivity. Mitigation is operational: a second channel
  (`direct`) that does not depend on the gateway being up, a phone hotspot, and a recorded
  run of `docs/TEST-CASES.md` as the last resort.
- Students run the stack on their own machine, so a vendor outage hits each of them
  independently. Switching `PLANNER_VENDOR` / `WRITER_VENDOR` to another of the three is the
  fix, and it is a one-line change they make themselves.

---

## 5. Repository layout

```
pawn-employee-assistant/
├── CLAUDE.md                    # engineering contract (Prompt 0 output; the rules fed to AI)
├── DESIGN.md                    # this document
├── WORKFLOW.md                  # stage protocol (Prompt 0 output)
├── Makefile                     # make dev / make demo / make down / make check
├── docker-compose.yml           # web + hr + it, healthchecked
├── Dockerfile.web
├── Dockerfile.server            # one image, AGENT build arg picks the server
├── docker-compose.yml
├── package.json                 # npm workspaces root
├── .env.example
├── apps/
│   └── web/                     # Next.js 16, port 3000
│       ├── app/
│       │   ├── page.tsx                  # chat UI
│       │   └── api/
│       │       ├── chat/route.ts         # orchestrator entry (SSE)
│       │       └── agents/register/route.ts
│       ├── lib/
│       │   ├── llm.ts                    # the only model exit
│       │   ├── registry.ts               # agent registry
│       │   ├── mcp-client.ts             # MCP client pool
│       │   └── orchestrator/
│       │       ├── plan.ts               # ① plan
│       │       ├── execute.ts            # ② execute
│       │       └── synthesize.ts         # ③ synthesize
│       └── components/
├── servers/
│   ├── hr/       :3101   employees.csv
│   ├── it/       :3102   tickets.sqlite
│   └── policy/   :3103   policies/*.md
├── packages/
│   └── mcp-kit/                 # shared server skeleton for the three servers
├── data/                        # fictional demo data
├── scripts/                     # check-llm / smoke-mcp / smoke-all
└── docs/
    ├── PRD.md                   # Prompt 1 output
    ├── BUILD-FROM-ZERO.md       # student manual: Prompts 0-11 with acceptance commands
    ├── INSTRUCTOR.md            # instructor runbook (Chinese)
    ├── ACCEPTANCE.md            # A1-A8 status
    ├── TEST-CASES.md            # cases the instructor reads aloud
    └── diagrams/                # architecture diagram (technical-diagram output)
```

---

## 6. Running it

```bash
# local development, four processes
npm install
cp .env.example .env
npm run dev

# straight to the vendor instead of through the gateway
LLM_PROVIDER=direct npm run dev

# delivery path
make demo
```

### Standing instance

The demo also runs as a standing instance on a shared lab host, used as the instructor's
fallback when a student's machine cannot reach a model vendor. Such a host usually carries a
Node too old for Next 16, so the stack runs entirely in containers and `docker compose`
supplies Node 22. The web UI binds `0.0.0.0:3000`; the MCP servers bind loopback only and
talk to the orchestrator over the compose network, which is why each server advertises
`ADVERTISE_URL` rather than `localhost`. See `docs/DEPLOY.md`.

Health checks:

```bash
curl localhost:3000/api/health     # orchestrator, includes registered agents
curl localhost:3101/health         # HR
curl localhost:3102/health         # IT
curl localhost:3103/health         # Policy
```

---

## 7. Acceptance criteria

When the code is done, all of these must hold:

1. `npm run dev` starts four processes with one command; all healthy within 30 seconds.
2. Flipping `LLM_PROVIDER` between `portkey` and `direct` changes the answer's route and not
   one line of application code.
3. "Who is my manager, and what tickets have I opened?" triggers concurrent HR and
   IT calls and returns one composed answer.
4. The UI shows all three stages as SSE events — no spinner.
5. Stopping `servers/it` degrades the answer instead of crashing, and `/api/health` reflects it.
6. Adding a fourth agent requires **zero lines changed** under `apps/web`.
7. `npm run typecheck` and `npm test` pass.
8. Total TypeScript stays under 2400 lines, comments and blank lines excluded.

Item 6 decides whether the architecture works. Item 8 decides whether it can be vibe-coded.

---

## 8. Open questions

- Which Portkey virtual keys to create (one each for DeepSeek / Kimi / Qwen). Guardrails for
  appendix B are **settled**: the gateway already redacts an email address that the direct
  channel echoes verbatim, with the same vendor on both sides and no application change.
  `npm run guardrail` is the probe.
- Whether a login gate is needed (Demo 1 has one; this depends on whether the repo is
  distributed outside PAWN).
- Where the instructor's reference `DESIGN.md` lives during class, given Prompt 0 has students
  generate their own. Current preference: students write `docs/DESIGN-student.md` and compare
  against this file afterwards.
