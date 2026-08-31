#!/bin/bash
# Shared helpers for booting one prompt-N tag and running its own acceptance.
REPO=$(git rev-parse --show-toplevel)
SP=${TAGCHECK_DIR:-${TMPDIR:-/tmp}/pawn-tagcheck}
RESULTS=$SP/tagcheck/results.tsv

pass() { printf '%s\t%s\tPASS\t%s\n' "$TAG" "$1" "${2:-}" >> "$RESULTS"; echo "    PASS  $1"; }
fail() { printf '%s\t%s\tFAIL\t%s\n' "$TAG" "$1" "${2:-}" >> "$RESULTS"; echo "    FAIL  $1  ${2:-}"; }
check() { # check <name> <command...>
  local name="$1"; shift
  local out; out=$("$@" 2>&1); local rc=$?
  if [ $rc -eq 0 ]; then pass "$name"; else fail "$name" "$(echo "$out" | tail -1 | cut -c1-120)"; fi
}

stop_stack() {
  pkill -f "concurrently -n web" 2>/dev/null
  for p in 3000 3101 3102 3103; do
    local pid; pid=$(lsof -ti:$p -sTCP:LISTEN 2>/dev/null)
    [ -n "$pid" ] && kill $pid 2>/dev/null
  done
  sleep 2
}

boot() { # boot <log> <ready-url> [ready-url2...]
  local log="$1"; shift
  nohup npm run dev > "$log" 2>&1 < /dev/null & disown
  local waited=0
  while [ $waited -lt 90 ]; do
    local all=1
    for u in "$@"; do curl -s -m 2 "$u" >/dev/null 2>&1 || all=0; done
    [ $all -eq 1 ] && return 0
    sleep 3; waited=$((waited+3))
  done
  return 1
}

mcp() { # mcp <port> <json> -> prints the data: payload
  curl -s -m 20 -X POST "localhost:$1/mcp" -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' -d "$2" | grep '^data: ' | sed 's/^data: //'
}

ask_sse() { # ask_sse <question> -> prints the SSE data payloads
  curl -sN -m 240 -X POST localhost:3000/api/chat -H 'Content-Type: application/json' \
    -d "$(python3 -c "import json,sys;print(json.dumps({'question':sys.argv[1]}))" "$1")" \
    | tr -d '\r' | grep '^data: ' | sed 's/^data: //'
}

ask_json() { # ask_json <question> -> prints the JSON body (pre-SSE prompts)
  curl -s -m 240 -X POST localhost:3000/api/chat -H 'Content-Type: application/json' \
    -d "$(python3 -c "import json,sys;print(json.dumps({'question':sys.argv[1]}))" "$1")"
}

setup_tree() { # setup_tree <tag> -> creates the worktree and installs
  TAG="$1"
  DIR=$SP/tagcheck/$TAG
  rm -rf "$DIR"
  git -C "$REPO" worktree remove --force "$DIR" 2>/dev/null
  git -C "$REPO" worktree add -q --detach "$DIR" "$TAG" || return 1
  cd "$DIR" || return 1
  [ -f package.json ] && npm install --silent > "$SP/tagcheck/$TAG-install.log" 2>&1
  # the student is given a key at Prompt 5; before that .env.example is enough
  [ -f .env.example ] && cp "$REPO/.env" .env
  return 0
}

teardown_tree() {
  cd "$REPO" || return
  git worktree remove --force "$SP/tagcheck/$TAG" 2>/dev/null
}
