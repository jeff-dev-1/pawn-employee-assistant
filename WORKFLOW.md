# Workflow — Stage Protocol

## The rule

Plan before generating. Every stage ends with a command someone can run.

## Each stage

1. **Plan.** State what will be created or changed, and how it will be verified. No code.
2. **Confirm.** I approve the plan, or narrow it. Scope only shrinks here.
3. **Generate.** Implement exactly the confirmed plan. Nothing extra, however helpful.
4. **Accept.** Run the stage's acceptance commands and show the output. A stage is not done
   because someone said it is done; it is done because a command printed what it should.
5. **Tag.** `git tag prompt-N` at the accepted state, so any stage can be rejoined later.

## Acceptance rules

- Acceptance is executable. "It works" is not acceptance.
- A green typecheck is not a green run. If a stage produces something runnable, run it.
- A test that cannot fail is not evidence. Show the failure path at least once per stage.

## When a stage goes wrong

Delete and redo the stage rather than patching forward. The tags exist so this is cheap.
