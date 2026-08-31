# PAWN Employee Assistant · Build From Zero

You are at the starting line. This tree contains one document and nothing else.

Over twelve prompts you will build an internal employee assistant: a Next.js orchestrator
that plans, calls three MCP servers concurrently, and composes one answer.

Prompts 0-4 need no API key and no internet. From Prompt 5 onward every model call goes to a
public endpoint - the Portkey gateway or a vendor directly. You will be given a key.

```bash
git checkout -b my-build start
open docs/BUILD-FROM-ZERO.md          # start at Prompt 0
```

Fell behind? `git checkout prompt-N` puts you at the end of step N.
Want to see the finished system? `git checkout main`.
