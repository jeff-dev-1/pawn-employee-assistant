# CLAUDE.md — Engineering Contract

## Identity

PAWN Employee Assistant. An internal assistant that answers employee questions about HR, IT,
and company policy. A Next.js orchestrator plans, calls three MCP servers concurrently, and
composes one answer.

## Stack (fixed — do not propose alternatives)

- TypeScript strict, Node >= 20.9
- Next.js 16 App Router + Tailwind
- MCP via `@modelcontextprotocol/sdk`, Streamable HTTP transport (the SSE transport is deprecated)
- LLM calls via the Vercel AI SDK `openai-compatible` provider
- npm workspaces. No pnpm, no turbo, no nx.
- Tests: vitest

## Directory conventions

```
apps/web/            orchestrator + UI, port 3000
  lib/llm.ts         the only file allowed to import a model SDK
  lib/registry.ts    agent registry
  lib/orchestrator/  plan.ts / execute.ts / synthesize.ts
servers/<name>/      one MCP server per data domain
  src/tools/         tool registration; business logic
  src/server.ts      Streamable HTTP entry
  src/stdio.ts       stdio entry (Claude Desktop)
packages/mcp-kit/    shared server skeleton
data/                fictional demo data
scripts/             check-llm / smoke-mcp / smoke-all
```

## Prohibitions

1. No MCP server may call an LLM. Servers provide data and tools; all reasoning happens in
   the orchestrator.
2. Only apps/web/lib/llm.ts may call a model. No other file may import a model SDK.
3. No vector database. The policy corpus is small enough to pass in the context window.
4. Hard cap of 2700 lines of TypeScript, counting neither comments nor blank lines.
   When you exceed it, delete before you add. Comments are not the thing being capped:
   in a teaching repository the explanation is the deliverable, and a rule that makes you
   delete one comment to add another has been turned against its own purpose.

   Raised twice, and the two reasons are not the same kind of reason. 2000 -> 2400 fixed a
   defect in the rule: it was counting comments, so writing down what was learned cost the
   same as writing code. 2400 -> 2700 fixed nothing; the demo simply grew a theme switch,
   two locales and a menu component, and the cap said no. That is the cap working. It is
   recorded here rather than quietly edited because the third time this happens the honest
   move is to delete a feature, and whoever faces that should be able to see that the
   number has already moved once for a reason that was not a good one.

## Language

Write all documentation, code comments, identifiers, and demo data in English.

## Conventions

- Ports come from environment variables, never hard-coded.
- A tool that finds nothing returns a structured `not_found`. It does not throw and does not
  return a natural-language apology.
- Concurrent tool calls use `Promise.allSettled`. Partial failure is normal, not exceptional.
- When an SDK API does not typecheck, read the type definitions under `node_modules/`.
  Do not guess a different call shape.
