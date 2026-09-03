#!/bin/bash
#
# Boot every prompt-N tag from a clean checkout and run that step's own acceptance.
#
# The manual promises "fell behind? git checkout prompt-N". This is what makes that a fact
# rather than a claim: a worktree per tag, npm install, and the acceptance commands that
# tag's own PROMPT block carries. It needs a .env with a real key (Prompt 5 onward calls a
# model) and it takes about twenty minutes.
#
#   bash scripts/verify-tags.sh
#   awk -F'\t' '$3=="FAIL"' "${TMPDIR:-/tmp}/pawn-tagcheck/tagcheck/results.tsv"
#
# Run it after anything that moves a tag, and before handing the repository to a cohort.
SP=${TAGCHECK_DIR:-${TMPDIR:-/tmp}/pawn-tagcheck}
mkdir -p "$SP/tagcheck"
source "$(dirname "$0")/verify-tags-lib.sh"
: > "$RESULTS"

# ---------------------------------------------------------------- prompt-0 / 1
for t in prompt-0 prompt-1; do
  echo "== $t"; setup_tree $t || { fail boot "worktree"; continue; }
  check "files exist"        test -f CLAUDE.md -a -f DESIGN.md -a -f WORKFLOW.md
  check "prohibition 1"      bash -c '[ "$(grep -c "No MCP server may call an LLM" CLAUDE.md)" = 1 ]'
  # The number lives in the tag's own CLAUDE.md, not here: this check runs against twelve
  # trees, and hard-coding today's cap turns the whole lineage red the next time it moves.
  check "the cap is stated"  bash -c 'grep -qE "Hard cap of [0-9]+ lines" CLAUDE.md'
  check "mapping table"      bash -c 'grep -q "find_employee" DESIGN.md && grep -q "search_policy" DESIGN.md'
  if [ "$t" = prompt-1 ]; then
    check "PRD cross-domain"   grep -q "Who is my manager" docs/PRD.md
    check "PRD has A1-A8"      bash -c '[ "$(grep -c "^| A[1-8]" docs/PRD.md)" = 8 ]'
    check "PRD no adjectives"  bash -c '! grep -iqE "smooth|intelligent|user-friendly" docs/PRD.md'
    check "PRD no interfaces"  bash -c '! grep -iqE "/api/|MCP tool|function |endpoint" docs/PRD.md'
  fi
  teardown_tree
done

# ---------------------------------------------------------------------- prompt-2
echo "== prompt-2"; stop_stack; setup_tree prompt-2
check "typecheck"        npm run typecheck
if boot "$SP/tagcheck/prompt-2.log" http://localhost:3000/api/health http://localhost:3101/health; then
  pass "npm run dev boots web + hr"
  check "web health"     bash -c 'curl -s -m 5 localhost:3000/api/health | grep -q "\"status\""'
  check "hr health"      bash -c 'curl -s -m 5 localhost:3101/health | grep -q "\"server\":\"hr\""'
  out=$(mcp 3101 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}')
  echo "$out" | grep -q '"capabilities":{}' && pass "capabilities are empty, as they should be" || fail "capabilities empty" "$out"
else fail "npm run dev boots web + hr" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-3
echo "== prompt-3"; setup_tree prompt-3
check "typecheck"          npm run typecheck
check "hr unit tests"      npm test -w servers/hr
if boot "$SP/tagcheck/prompt-3.log" http://localhost:3101/health; then
  pass "servers boot"
  n=$(mcp 3101 '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | python3 -c "import sys,json;print(len(json.load(sys.stdin)['result']['tools']))" 2>/dev/null)
  [ "$n" = 2 ] && pass "tools/list returns 2" || fail "tools/list returns 2" "got $n"
  hit=$(mcp 3101 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"find_employee","arguments":{"name":"Dana Reeve"}}}')
  echo "$hit" | grep -q "Dana Reeve" && pass "tools/call returns real data" || fail "tools/call returns real data" "$hit"
  miss=$(mcp 3101 '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_employee","arguments":{"name":"Nobody Here"}}}')
  echo "$miss" | grep -q "not_found" && pass "a miss is structured, not an exception" || fail "structured miss" "$miss"
  cap=$(mcp 3101 '{"jsonrpc":"2.0","id":4,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"p","version":"0"}}}')
  echo "$cap" | grep -q '"tools"' && pass "capabilities now advertise tools" || fail "capabilities advertise tools" "$cap"
else fail "servers boot" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-4
echo "== prompt-4"; setup_tree prompt-4
check "typecheck"          npm run typecheck
check "hr unit tests"      npm test -w servers/hr
if boot "$SP/tagcheck/prompt-4.log" http://localhost:3101/health; then
  pass "servers boot"
  check "npm run smoke (Streamable HTTP)"  npm run smoke
  check "smoke over stdio"                 npm run smoke:stdio
  npx tsx scripts/smoke-mcp.ts http://localhost:3999/mcp >/dev/null 2>&1
  [ $? -ne 0 ] && pass "smoke exits 1 against a dead port" || fail "smoke exits 1 against a dead port" "exited 0"
else fail "servers boot" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-5
echo "== prompt-5"; setup_tree prompt-5
check "typecheck"                     npm run typecheck
check "check-llm on portkey"          bash -c 'LLM_PROVIDER=portkey npm run check-llm 2>&1 | grep -q "^writer"'
check "check-llm on direct"           bash -c 'LLM_PROVIDER=direct  npm run check-llm 2>&1 | grep -q "^writer"'
check "two vendors, one answer"       bash -c 'PLANNER_VENDOR=deepseek WRITER_VENDOR=moonshot npm run check-llm 2>&1 | grep -q "^writer"'
check "a missing key fails by name"   bash -c 'PORTKEY_API_KEY= LLM_PROVIDER=portkey npm run check-llm 2>&1 | grep -q "PORTKEY_API_KEY is required"'
check "flipping the channel changes no code" bash -c 'git -C . diff --quiet'
teardown_tree

# ---------------------------------------------------------------------- prompt-6
echo "== prompt-6"; stop_stack; setup_tree prompt-6
check "typecheck"        npm run typecheck
check "planner tests"    npm test -w apps/web
if boot "$SP/tagcheck/prompt-6.log" http://localhost:3000/api/health http://localhost:3101/health; then
  pass "servers boot and register"
  sleep 5
  curl -s -m 5 localhost:3000/api/health | grep -q '"hr"' && pass "hr registered itself" || fail "hr registered itself"
  one=$(ask_json "How many vacation days do I have left?" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['plan']['calls']))" 2>/dev/null)
  [ "$one" = 1 ] && pass "a single-domain question plans exactly 1 call" || fail "single-domain plans 1 call" "got $one"
  none=$(ask_json "When is the company holiday party?" | python3 -c "import sys,json;print(len(json.load(sys.stdin)['plan']['calls']))" 2>/dev/null)
  [ "$none" = 0 ] && pass "an unanswerable question plans nothing" || fail "unanswerable plans nothing" "got $none"
else fail "servers boot and register" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-7
echo "== prompt-7"; setup_tree prompt-7
check "typecheck"   npm run typecheck
if boot "$SP/tagcheck/prompt-7.log" http://localhost:3101/health http://localhost:3102/health; then
  pass "web + hr + it boot"
  check "all tests, pipeline included" npm test
  sleep 5
  hr=$(ask_json "How many vacation days do I have left?" | python3 -c "import sys,json;print(','.join(sorted({c['server'] for c in json.load(sys.stdin)['plan']['calls']})))" 2>/dev/null)
  [ "$hr" = hr ] && pass "vacation question -> HR only" || fail "vacation -> HR only" "got '$hr'"
  it=$(ask_json "What's the status of my laptop ticket?" | python3 -c "import sys,json;print(','.join(sorted({c['server'] for c in json.load(sys.stdin)['plan']['calls']})))" 2>/dev/null)
  [ "$it" = it ] && pass "ticket question -> IT only" || fail "ticket -> IT only" "got '$it'"
  both=$(ask_json "Who is my manager, and what tickets have I opened?" | python3 -c "import sys,json;print(','.join(sorted({c['server'] for c in json.load(sys.stdin)['plan']['calls']})))" 2>/dev/null)
  [ "$both" = "hr,it" ] && pass "cross-domain question -> HR + IT" || fail "cross-domain -> HR + IT" "got '$both'"
else fail "web + hr + it boot" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-8
echo "== prompt-8"; stop_stack; setup_tree prompt-8
check "typecheck"   npm run typecheck
if boot "$SP/tagcheck/prompt-8.log" http://localhost:3101/health http://localhost:3102/health; then
  pass "servers boot"
  check "all tests" npm test
  sleep 5
  ask_sse "Who is my manager, and what tickets have I opened?" > "$SP/tagcheck/p8-sse.txt"
  python3 - "$SP/tagcheck/p8-sse.txt" <<'PY'
import sys, json
types = [json.loads(l)['type'] for l in open(sys.argv[1]) if l.strip()]
extra = sorted(set(types) - {'plan','execute','answer','error'})
order = [t for i,t in enumerate(types) if i==0 or types[i-1]!=t]
ok = not extra and types.count('plan')==1 and order[0]=='plan' and 'execute' in order and 'answer' in order
print('OK' if ok else f'BAD order={order} extra={extra}')
PY
  grep -q OK <<< "$(python3 - "$SP/tagcheck/p8-sse.txt" <<'PY'
import sys, json
types = [json.loads(l)['type'] for l in open(sys.argv[1]) if l.strip()]
extra = sorted(set(types) - {'plan','execute','answer','error'})
order = [t for i,t in enumerate(types) if i==0 or types[i-1]!=t]
print('OK' if (not extra and types.count('plan')==1 and order[0]=='plan') else 'BAD')
PY
)" && pass "SSE emits only the four shapes, plan first" || fail "SSE four shapes"
  curl -s -m 5 localhost:3000 | grep -q "PAWN Employee Assistant" && pass "the page renders" || fail "the page renders"
  test -f apps/web/components/trace.tsx && pass "the trace is its own component" || fail "trace component exists"
else fail "servers boot" "timed out"; fi
stop_stack; teardown_tree

# ---------------------------------------------------------------------- prompt-9
echo "== prompt-9"; setup_tree prompt-9
check "typecheck"   npm run typecheck
# the grading criterion: adding the third agent changed nothing under apps/web
git -C . diff --quiet prompt-8 HEAD -- apps/web && pass "git diff apps/web is empty (the only grading criterion)" \
  || fail "git diff apps/web is empty" "$(git -C . diff --stat prompt-8 HEAD -- apps/web | tail -1)"
if boot "$SP/tagcheck/prompt-9.log" http://localhost:3101/health http://localhost:3102/health http://localhost:3103/health; then
  pass "all four processes boot"
  check "all tests" npm test
  sleep 6
  n=$(curl -s -m 5 localhost:3000/api/health | python3 -c "import sys,json;print(len(json.load(sys.stdin)['agents']))" 2>/dev/null)
  [ "$n" = 3 ] && pass "three agents registered" || fail "three agents registered" "got $n"
  pol=$(ask_sse "What is the remote work policy?" | python3 -c "
import sys,json
srv=[]
for l in sys.stdin:
    e=json.loads(l)
    if e['type']=='plan': srv=[c['server'] for c in e['calls']]
print(','.join(sorted(set(srv))))" 2>/dev/null)
  [ "$pol" = policy ] && pass "the new agent answers its own domain" || fail "policy question -> policy" "got '$pol'"
else fail "all four processes boot" "timed out"; fi
stop_stack; teardown_tree

# ------------------------------------------------------------------- prompt-10
echo "== prompt-10"; setup_tree prompt-10
check "typecheck"   npm run typecheck
if boot "$SP/tagcheck/prompt-10.log" http://localhost:3101/health http://localhost:3102/health http://localhost:3103/health; then
  pass "all four processes boot"
  check "all tests" npm test
  sleep 6
  itpid=$(lsof -ti:3102 -sTCP:LISTEN); kill $itpid 2>/dev/null; sleep 3
  ask_sse "Who is my manager, and what tickets have I opened?" > "$SP/tagcheck/p10-sse.txt"
  python3 - "$SP/tagcheck/p10-sse.txt" > "$SP/tagcheck/p10-verdict.txt" <<'PY'
import sys, json
ok_calls, bad_calls, answer = [], [], ''
for l in open(sys.argv[1]):
    e = json.loads(l)
    if e['type'] == 'execute': (ok_calls if e['ok'] else bad_calls).append(e['server'])
    if e['type'] == 'answer': answer += e['delta']
print('HALF_OK' if ok_calls and bad_calls else 'BAD')
print('NAMED' if any(w in answer.lower() for w in ('unable','could not','not able','failed','cannot')) else 'SILENT')
PY
  grep -q HALF_OK "$SP/tagcheck/p10-verdict.txt" && pass "one server dead: the surviving call still returns" || fail "surviving call returns"
  grep -q NAMED  "$SP/tagcheck/p10-verdict.txt" && pass "the answer names what it could not retrieve" || fail "answer names the gap"
  ok=no
  for i in $(seq 1 20); do
    curl -s -m 5 localhost:3000/api/health | grep -q '"status":"degraded"' && { ok=yes; break; }
    sleep 5
  done
  [ "$ok" = yes ] && pass "/api/health goes degraded after three missed beats" || fail "health goes degraded" "still ok after 100s"
else fail "all four processes boot" "timed out"; fi
stop_stack; teardown_tree

# --------------------------------------------------------------- prompt-10-bug
echo "== prompt-10-bug"; setup_tree prompt-10-bug
check "the regression is present" bash -c 'grep -q "Promise.all(" apps/web/lib/orchestrator/execute.ts'
check "it forks from prompt-9"    bash -c 'git -C . merge-base --is-ancestor prompt-9 HEAD'
teardown_tree

# ------------------------------------------------------------------- prompt-11
echo "== prompt-11"; stop_stack; setup_tree prompt-11
check "typecheck"   npm run typecheck
if boot "$SP/tagcheck/prompt-11.log" http://localhost:3101/health http://localhost:3102/health http://localhost:3103/health; then
  pass "all four processes boot"
  check "all tests"  npm test
  sleep 6
  check "hr health"      bash -c 'curl -s -m 5 localhost:3101/health | grep -q hr'
  check "it health"      bash -c 'curl -s -m 5 localhost:3102/health | grep -q it'
  check "policy health"  bash -c 'curl -s -m 5 localhost:3103/health | grep -q policy'
  check "npm run smoke across every agent" npm run smoke
  n=$(cat $(git -C . ls-files '*.ts' '*.tsx') | grep -vcE '^[[:space:]]*(//|/\*|\*|$)')
  limit=$(grep -oE "Hard cap of [0-9]+" CLAUDE.md | grep -oE "[0-9]+")
  limit=${limit:-2400}
  [ "$n" -lt "$limit" ] && pass "under the ${limit}-line cap" "$n" || fail "under the ${limit}-line cap" "$n"
else fail "all four processes boot" "timed out"; fi
stop_stack; teardown_tree

echo "=== DONE ==="
