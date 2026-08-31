# Replay Findings

On 2026-08-31 the whole project was rebuilt from `docs/BUILD-FROM-ZERO.md` in a clean
worktree off `start`: every prompt pasted in order, every acceptance command run, nothing
copied from `main`. Twenty-four places where the prompts and this repository disagreed came out of it —
eighteen from the rebuild itself, five more from reconciling `main` onto the rebuilt lineage
and redeploying it to the lab node, and one more from booting all twelve tags from clean
checkouts. All of
them are fixed in the manual; the ones that were also code defects are fixed in `main`.

Kept because the next person to change a prompt should know what a replay catches, and
because several of these had been shipping for weeks without anyone noticing.

| # | Prompt | Finding | Fix |
|---|---|---|---|
| 1 | 0 | The block asks for "the agent-to-MCP-tool mapping table" but names no tools. Whatever the AI invents becomes the contract Prompt 3 then checks against ("each must correspond to a row"), so Prompt 3's traceability requirement is unverifiable in practice. | Pin the five rows in Prompt 0. |
| 2 | 1 | `grep -inE "smooth\|intelligent\|user-friendly"` false-positives: the AI naturally writes a sentence *claiming* it avoided those words. | Tell it not to; the grep is the claim. |
| 3 | 2 | No prompt pins package versions. The pinned table lives only in the instructor's DESIGN.md. `^16.3.3` happened to resolve correctly today. | State the five pinned versions in Prompt 2. |
| 4 | 2 | `@types/express` is needed and nothing says so. Ordinary friction; the AI fixes it from the error. | No change. |
| 5 | 2 | The "Expected:" block omits the `event: message` line the server actually sends before `data:`. | Show the real two-line frame. |
| 6 | 2 / 5 | **`.env` never reaches the MCP servers or the scripts.** `tsx` does not read `.env`, so `HR_PORT=3151` in `.env` is silently ignored and the server binds its default. Confirmed on the replay AND present on `main`. Consequence: Prompt 5's acceptance (`npx tsx scripts/check-llm.ts`) cannot work for a student whose keys are only in `.env`. | `tsx --env-file=../../.env` in every server's dev/start script, `tsx --env-file=.env` in every root script. Verified working on Node 20.19.3. |
| 7 | 3 | **`data/employees.csv` is resolved against the working directory, so `npm run dev` produces a 500 on every tool call.** Confirmed on the replay AND on `main`: `npm run dev` at the repo root logs `ENOENT: no such file or directory, open 'data/employees.csv'` because the workspace script runs with cwd `servers/hr`. Only the docker path works, because the image sets its own WORKDIR. Every tag from `prompt-3` onward inherits this. | Resolve a relative data path against the module (`import.meta.url`), keeping an absolute `HR_DATA_FILE` override. Ties directly to Prompt 4's "every path must be absolute" note for Claude Desktop. |
| 8 | 2, 3 | The acceptance `curl`s print a raw SSE frame (`event: message` + `data: {...}` + blank line). Any student piping it to `tail -1` gets the blank line. | Show the real frame and pipe through `grep '^data: '`. |
| 9 | 4 | `tsx watch` restarts on save; a smoke run fired immediately after an edit reports `fetch failed`, which reads like a protocol failure. | One line in the manual: if smoke fails right after an edit, the watcher is still restarting. |
| 10 | 5 | The missing-key acceptance works — `PORTKEY_API_KEY is required for LLM_PROVIDER=portkey` — but `tsx` prints a multi-kilobyte `data:text/javascript,...` source-map frame around it, so the message is invisible in a terminal. | Pipe the acceptance through `grep "is required"`. |
| 11 | 2, 5, 9 | **`start`'s `.gitignore` is missing `*.tsbuildinfo`** (main's has it). `apps/web/tsconfig.tsbuildinfo` therefore gets committed and then shows up modified in every later `git diff`. This breaks the two most important acceptance checks in the course: Prompt 5's "`git diff --stat` must be empty" and Prompt 9's "`git diff --stat apps/web` must be empty". | Sync `start`'s `.gitignore` with main's. |
| 12 | 5 | `git diff --stat # must be empty` is wrong as written: Prompt 5 itself adds `llm.ts`, `check-llm.ts`, `.env.example` and lockfile changes, so the diff is never empty when the student runs it. The claim being tested is that *flipping the channel* changes no code. | Commit the step first, then flip `LLM_PROVIDER` and check the diff. Say so in the prompt. |
| 13 | 2 / 6 | **`apps/web` cannot see the root `.env`, and no prompt says how to fix it.** Next reads `.env` from its own directory, which under npm workspaces is `apps/web`. From Prompt 6 onward every request dies with `PORTKEY_API_KEY is required for LLM_PROVIDER=portkey`. `main` works only because someone hand-wrote a root-`.env` loader into `apps/web/next.config.ts` in a later session and never put it in the manual. **This alone makes the manual unable to build the working system.** | Prompt 2 must require the loader in `next.config.ts`, with the reason. |
| 14 | 6 | Prompt 6 says the orchestrator "pulls each server's tools/list when that server registers", but no prompt ever builds the registration mechanism: `lib/mcp-client.ts`, `POST /api/agents/register`, and the servers' announce-on-a-heartbeat. The heartbeat in particular is what Prompt 10's staleness check depends on. | List all three as Prompt 6 deliverables. |
| 15 | 7 | Prompt 7 says "Data source: `data/tickets.sqlite` via better-sqlite3", and DESIGN.md's tree lists `tickets.sqlite`. No such file exists or should. What `main` actually does — and what is better — is an **in-memory** SQLite database seeded at startup from `data/tickets.csv`, so students can read and edit the data in a text editor and still write real SQL. | Say that in Prompt 7 and fix DESIGN.md's tree. |
| 16 | 11 | Prompt 11 asks for a four-service `docker-compose.yml` but never asks for the two Dockerfiles it needs, nor for the two things that only bite in containers: servers must advertise their **service name** (`ADVERTISE_URL`), and `createMcpExpressApp`'s DNS-rebinding protection refuses any Host header that is not loopback unless the service names are declared. | Add both to Prompt 11. |
| 17 | 11 | Prompt 11's acceptance opens with `make demo`, which needs Docker. The student prerequisites list (INSTRUCTOR.md) asks only for Node and git. | Say Docker is needed for Prompt 11, or mark `make demo` optional. |
| 18 | 11 | `main`'s `scripts/smoke-all.ts` hard-codes three URLs **and** a per-tool argument map, so a fourth agent fails with `no smoke arguments defined for X`. It is the one file a new agent forces you to edit. | Discover agents from `/api/health` and derive arguments from each tool's own `inputSchema.required`. Verified working in the replay. |

## What the replay could not check

| Claim | Why |
|---|---|
| `make demo` — docker compose, four services | Docker is not installed on the machine the replay ran on. The compose path is exercised on the lab node; see `docs/DEPLOY.md`. |
| Appendix B's gateway guardrail | Verified separately against the live Portkey account, with the same vendor on both channels. See the appendix. |

## Also produced

The rebuild is the lineage the `prompt-N` tags sit on, and `main` now descends from it.

Before this, `prompt-5` through `prompt-11` still shipped an Ollama-based `lib/llm.ts` from
an earlier design — a student rejoining at `prompt-6` got a system that needed a local model
the project had already removed, and that no prompt described. That is not something a
mechanical patch fixes, which is why the tags were rebuilt rather than repaired.

Rebuilding the tags then exposed the same problem one level up: `main` was not on the tag
lineage either, so `git clone` and "build it yourself" produced structurally different trees
and there was no document saying which was authoritative. Reconciling them turned up three
more things the manual asked for and this repository had, or the reverse:

| # | Prompt | Finding | Fix |
|---|---|---|---|
| 19 | 6, 7 | Sixteen orchestrator tests existed in this repository — mocked-model planner tests, the `allSettled` guarantees, and one pipeline test with real MCP servers — and no prompt ever asked for a single one of them. | Prompts 6 and 7 now ask for all three, and the tag lineage has them. |
| 20 | 8 | The UI was split into `trace.tsx` and `prompt-input.tsx` here, while Prompt 8 only said "render by event type", so anyone building from the manual got one long `page.tsx`. | Prompt 8 now asks for the split, and says why: the trace is a component whose only input is the `Stage[]` the SSE parser produced. |
| 21 | 2 | `--env-file=.env` makes Node exit with code 9 when `.env` does not exist yet, which is the state every student is in before `cp .env.example .env`. The failure says nothing useful. | `--env-file-if-exists` everywhere; a missing key is then caught by the config check, which names the variable. |
| 22 | 11 | `next build` inside the web image dies with a bare `EPERM: operation not permitted, write` — no path, no mention of what it was writing. It is the telemetry file, and the container's home directory is not writable. Found by redeploying the migrated tree to the lab node. | `ENV NEXT_TELEMETRY_DISABLED=1` in `Dockerfile.web`, and Prompt 11 now asks for it and says why. |
| 23 | 11 | With the containers healthy, `/api/health` reported `agents: []` and every server logged `register returned 502`. The prompt does say to declare the service names past DNS-rebinding protection, but the compose file never passed them, so the orchestrator's `Host: hr:3000` was refused. Healthy containers and an empty registry is the worst shape this failure can take. | `ALLOWED_HOSTS` per service in `docker-compose.yml`, in both `prompt-11` and `main`. |
| 24 | 4, 5 | Booting all twelve tags turned up one failure: at `prompt-5`, `git diff` is dirty the moment you run `npm install`. `servers/hr/src/stdio.ts` is a declared `bin` target, npm chmods every bin target, and the file was committed 644 — so it shows as modified with zero insertions and zero deletions. Prompt 5's whole claim is "flipping the channel changes no code, and `git diff` proves it", and the proof was broken by the install that precedes it. | The three stdio entries are committed executable across the lineage, and Prompt 4 now says to do that and why. |
