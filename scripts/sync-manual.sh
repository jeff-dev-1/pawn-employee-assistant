#!/usr/bin/env bash
# The manual is one document, and a student who checks out prompt-3 to rejoin must read the
# same one they were handed. But it lives in the tree, so every edit on `main` makes thirteen
# refs stale silently. This happened twice in one day before it became a script.
#
#   scripts/sync-manual.sh --check   report drift, write nothing, exit 1 if any
#   scripts/sync-manual.sh           rewrite every ref to carry main's manual, locally
#   scripts/sync-manual.sh --push    ...and force-push, only after the checks below pass
#
# --push also pushes when the local refs are already in sync, because `git fetch --tags
# --force` pulls the remote's stale tags back over them and the drift reappears locally.
#
# It rewrites history. Three things are verified before anything leaves the machine:
# every ref carries the target blob, NOTHING ELSE changed at any ref, and no ref lost a
# commit. A backup branch per ref is created first and never deleted by this script.
set -euo pipefail

MANUAL=docs/BUILD-FROM-ZERO.md
REFS=(start prompt-0 prompt-1 prompt-2 prompt-3 prompt-4 prompt-5 prompt-6 prompt-7
      prompt-8 prompt-9 prompt-10 prompt-10-bug prompt-11 main demo/topology)
mode=${1:-sync}

cd "$(git rev-parse --show-toplevel)"
target=$(git show "main:$MANUAL" | git hash-object --stdin)

drift=()
for r in "${REFS[@]}"; do
  git rev-parse -q --verify "$r" >/dev/null || continue
  h=$(git show "$r:$MANUAL" | git hash-object --stdin)
  [ "$h" = "$target" ] || drift+=("$r")
done

if [ ${#drift[@]} -eq 0 ]; then
  echo "manual is identical across ${#REFS[@]} refs locally ($target)"
  # Not a reason to stop when pushing: the local refs can be in sync while the remote's are
  # not - which is exactly what happens after a local run, and cost a confusing round trip
  # the first time this script was used.
  if [ "$mode" = "--push" ]; then
    git push -q --force origin "${REFS[@]}"
    git push -q --force --tags origin
    echo "pushed"
  fi
  exit 0
fi
echo "drifted from main: ${drift[*]}"
[ "$mode" = "--check" ] && exit 1

[ -z "$(git status --porcelain)" ] || { echo "working tree is dirty; refusing"; exit 1; }

stamp=$(date +%Y%m%d-%H%M%S)
for r in "${REFS[@]}"; do
  git rev-parse -q --verify "$r" >/dev/null || continue
  git branch -q "backup/manual-$stamp/${r//\//-}" "$r"
done
echo "backed up to backup/manual-$stamp/*"

# --index-filter replaces the blob in place. Safe here only because the file exists in every
# commit of every listed ref; `git update-index --cacheinfo` on a path that does not exist
# would ADD it, quietly putting the manual into commits that never had one.
for r in "${REFS[@]}"; do
  git rev-parse -q --verify "$r" >/dev/null || continue
  for c in $(git rev-list "$r"); do
    git cat-file -e "$c:$MANUAL" 2>/dev/null || { echo "commit $c has no $MANUAL; refusing"; exit 1; }
  done
done

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
  --index-filter "git update-index --cacheinfo 100644,$target,$MANUAL" \
  --tag-name-filter cat -- "${REFS[@]}" >/dev/null

fail=0
for r in "${REFS[@]}"; do
  git rev-parse -q --verify "$r" >/dev/null || continue
  b="backup/manual-$stamp/${r//\//-}"
  h=$(git show "$r:$MANUAL" | git hash-object --stdin)
  [ "$h" = "$target" ] || { echo "  BAD blob at $r"; fail=1; }
  other=$(git diff --name-only "$b" "$r" -- . ":(exclude)$MANUAL")
  [ -z "$other" ] || { echo "  BAD $r also changed: $other"; fail=1; }
  before=$(git rev-list --count "$b"); after=$(git rev-list --count "$r")
  [ "$before" = "$after" ] || { echo "  BAD $r commits $before -> $after"; fail=1; }
done
[ "$fail" = 0 ] || { echo "verification failed; nothing pushed. Restore from backup/manual-$stamp/*"; exit 1; }
echo "verified: blob identical, nothing else changed, no commits lost"

[ "$mode" = "--push" ] || { echo "not pushed (pass --push)"; exit 0; }
git push -q --force origin "${REFS[@]}"
git push -q --force --tags origin
echo "pushed"
