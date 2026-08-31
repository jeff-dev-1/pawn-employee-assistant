# PAWN Employee Assistant

An internal employee assistant built for the PAWN Vibe Coding training (**Demo 2**).
Ask a question in natural language; the system decides which data domains to consult,
fetches from them concurrently, and composes one answer.

> "Who is my manager, and what tickets have I opened?"
> → HR and IT are queried in parallel, and one answer comes back.

Four processes: a Next.js orchestrator plus three MCP servers (HR, IT, Policy).
All reasoning lives in the orchestrator; the MCP servers are pure capability providers.

## Two ways to use this repository

### 1. Run it

```bash
cp .env.example .env
make demo                      # docker compose up, four services
open http://localhost:3000
```

Every model call goes to a public endpoint: the Portkey gateway (`LLM_PROVIDER=portkey`) or
a vendor directly (`LLM_PROVIDER=direct`). There is no locally hosted model.

### 2. Build it from zero yourself

This is what the training is for. You start from an empty tree and grow the whole system
through twelve prompts.

```bash
git checkout -b my-build start
open docs/BUILD-FROM-ZERO.md
```

Fell behind? `git checkout prompt-N` rejoins at the end of step N.

## Documentation

| File | For |
|---|---|
| [`docs/BUILD-FROM-ZERO.md`](docs/BUILD-FROM-ZERO.md) | Students: Prompts 0–11 with acceptance commands |
| [`DESIGN.md`](DESIGN.md) | Architecture, technology choices, what was deliberately cut |
| [`docs/INSTRUCTOR.md`](docs/INSTRUCTOR.md) | Instructor runbook: pacing, set pieces, what to do when it goes wrong |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | The standing instance on the lab node |
| [`docs/REPLAY-FINDINGS.md`](docs/REPLAY-FINDINGS.md) | What rebuilding the project from the manual caught |

## Branches and tags

| Ref | Contents |
|---|---|
| `main` | `prompt-11` plus the two appendices (the `ToolLoopAgent` orchestrator, the guardrail probe) and the instructor's own documents. A direct descendant of `prompt-11`. |
| `start` | Student starting point: the build manual and nothing else. |
| `prompt-0` … `prompt-11` | Snapshot at the end of each step, for rejoining. |
| `prompt-10-bug` | The planted `Promise.all` regression Prompt 10 diagnoses, forked from `prompt-9`. |
| `backup/*` | The previous history, kept until the next cohort. Safe to delete. |

**One world line: `start` → `prompt-0` … `prompt-11` → `main`.** The whole tree was produced
by building the project from the manual in a clean checkout on 2026-08-31 — every prompt
pasted in order, every acceptance command run — so what a student finishes with really is
what `git clone` gives them, and `git diff prompt-11 main` is a short, readable list of what
the appendices and the instructor's documents add on top.

Fell behind? `git checkout prompt-N` rejoins at the end of step N. That is checked, not
assumed: `bash scripts/verify-tags.sh` boots all twelve tags from clean checkouts and
runs each step's own acceptance commands.
