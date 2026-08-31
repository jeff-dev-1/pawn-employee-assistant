# WORKFLOW.md — Stage Protocol

## The rule

**Plan before generating.** For every step: output a plan, wait for confirmation, generate,
then give an executable acceptance command. Nothing is done because someone said so.

## Stages

| Stage | Prompts | Output |
|---|---|---|
| Context | 0–1 | CLAUDE.md, DESIGN.md, WORKFLOW.md, docs/PRD.md |
| Provider | 2–4 | A real MCP server with protocol-level acceptance |
| Consumer | 5–8 | Orchestrator: model exit, planner, concurrency, synthesis, SSE |
| Hardening | 9–11 | Third agent, debugging, delivery |

## Per-step protocol

1. Restate the constraints from CLAUDE.md that apply to this step.
2. Output a plan. Do not write code yet.
3. On confirmation, generate. One commit per logical step.
4. Give an acceptance command that exits non-zero on failure.
5. Tag `prompt-N`.

## Acceptance rules

- An acceptance command is a command, not a description.
- Protocol-level acceptance uses the official SDK client. Importing the server's internals
  to "test" it does not count.
- A step is not done while `npm run typecheck` fails.
