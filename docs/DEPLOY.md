# Deploying a Standing Instance

The demo runs on a laptop with `npm run dev`. A **standing instance** — one host, always up,
used as the instructor's fallback when a student's machine cannot reach a model vendor — runs
in containers instead. This document is what that costs and what only breaks there.

Substitute your own host for `$HOST` throughout. Nothing here is specific to one machine.

## Why containers

A host old enough to be in a lab is usually running a Node too old for Next 16, which needs
>= 20.9. `docker compose` supplies Node 22 and leaves the host toolchain alone.

If the host is shared, keep the blast radius named: this stack owns one directory and the
containers called `pawn-*`, and nothing else.

## Deploy

From a laptop with the repository checked out:

```bash
ssh root@$HOST 'mkdir -p /data/pawn-employee-assistant'
git archive main | ssh root@$HOST 'tar -x -C /data/pawn-employee-assistant'
ssh root@$HOST 'cd /data/pawn-employee-assistant && cp -n .env.example .env && docker compose up -d --build'
```

`git archive` sends the tracked tree only — no `node_modules`, no `.git`, about 700 KB.

## Fill in the key

The instance starts and self-registers without a key, but every question fails at the planning
stage until one is present:

```bash
ssh root@$HOST
vi /data/pawn-employee-assistant/.env     # PORTKEY_API_KEY, or LLM_PROVIDER=direct + a vendor key
cd /data/pawn-employee-assistant && docker compose up -d
```

Keys live only in that file. They are never committed and never passed on a command line.

## Verify

```bash
ssh root@$HOST '
  cd /data/pawn-employee-assistant
  docker compose ps                   # four services, all healthy
  curl -s localhost:3000/api/health   # three agents registered, all live
  curl -s localhost:3101/health
  curl -s localhost:3102/health
  curl -s localhost:3103/health
  curl -sN -X POST localhost:3000/api/chat -H "Content-Type: application/json" \
    -d "{\"question\":\"Who is my manager, and what tickets have I opened?\"}" | head -3'
```

**`npm run smoke` does not work against a compose instance, and that is not a bug.** The
registry holds the URLs the servers advertise, which inside compose are container service
names (`http://hr:3000/mcp`). The host cannot resolve those, and the web image deliberately
does not ship `scripts/`. Smoke is for the local `npm run dev` stack; here, the health
endpoints plus one real question are the acceptance.

## Cost

The four containers carry `restart: unless-stopped` and call a paid vendor on every question.
There is no usage alarm. When the instance is not needed:

```bash
ssh root@$HOST 'cd /data/pawn-employee-assistant && docker compose down'
```

## Reaching it from a laptop

A standing instance is often reachable on the lab network and not over a corporate VPN, where
a narrow filter may permit TCP 22 and nothing else. Before blaming the deployment, check both
ends — the failure looks identical from the browser either way:

```bash
# on the host - all of these should pass
docker port pawn-web                                  # 3000/tcp -> 0.0.0.0:3000
ss -lntp | grep :3000                                 # docker-proxy on *:3000
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health   # 200
systemctl is-active firewalld                         # inactive
iptables -L INPUT -n | head -3                        # policy ACCEPT, no rules

# from the laptop - if only 22 answers, the filter is upstream
for p in 22 3000; do nc -z -G 4 "$HOST" $p && echo "$p open" || echo "$p blocked"; done
```

Host wide open, laptop blocked on every port but 22 → the filter is on the network path, not
in the deployment. **Use an SSH tunnel.** No firewall change on a shared node, nothing exposed
to anyone else:

```bash
ssh -N -L 3300:localhost:3000 root@$HOST
open http://localhost:3300
```

Port 3300 rather than 3000 because a local `npm run dev` already owns 3000.

Reachability is a property of one network path, not of the demo. Students build and run the
stack on their own machine and open `localhost:3000`; nothing in the training depends on a
standing instance.

## Four things that only break in a container

**`next dev` dies with `EPERM: operation not permitted, write`.** Its interactive dev UI
writes to a TTY, and compose gives it none. A standing instance runs `next build` at image
time and `next start` at runtime, which is the right choice anyway: faster, smaller, less
memory. Local development still uses `next dev`.

**`next build` dies with the same bare `EPERM`.** Different cause, no path in the message: it
is the telemetry file, and the container's home directory is not writable. `Dockerfile.web`
sets `NEXT_TELEMETRY_DISABLED=1`.

**BusyBox `wget` resolves `localhost` to `::1` and fails with `Invalid argument`.** Health
probes pin `127.0.0.1` and use separate flags (`-q -O /dev/null`), not the combined `-qO-`.

**The MCP SDK rejects the orchestrator's Host header.** `createMcpExpressApp()` turns on
DNS-rebinding protection by default and only trusts a loopback Host. Behind compose the
orchestrator dials `http://hr:3000/mcp`, so the Host header is `hr:3000` and every request is
refused — registration returns HTTP 502 **while all four containers report healthy**. The fix
keeps the protection and declares the legitimate names through `ALLOWED_HOSTS`, rather than
switching it off. See `packages/mcp-kit/src/index.ts` and `docker-compose.yml`.

That last one is only visible because registration checks `response.ok`. A server that logged
"registered" on any completed fetch would have looked perfectly healthy while being
unreachable.

## Publishing the repository

Before pushing this repository anywhere public, scan it for anything that should not leave
the building. The rule that matters is not *what* you grep for — it is **what you grep over**.

**The scan scope must equal the publish set exactly. Not more, not less.**

Both mistakes were made while preparing this repository, hours apart:

| Mistake | Effect |
|---|---|
| Scanned `git log --all` / `git rev-list --all` | Counted branches that were never going to be pushed. Produced two false alarms — a "third-party email" and "166 internal addresses" — both in local backup branches. |
| Scanning only `main` | Would have missed the tags entirely. The tags are what students clone. |

Too wide manufactures noise, and noise trains you to skim. Too narrow clears something that
was never looked at. The second one is how secrets ship.

```bash
# 1. name the publish set once, and derive it - do not type it twice
PUBLISH_REFS="main start $(git tag -l)"

# 2. scan exactly that set, full history of each ref
for r in $PUBLISH_REFS; do
  # Match partial references too. A pattern anchored on full dotted quads let "$HOST"
  # through into a public repository, in prose, in a file nobody thought to re-scan.
  git grep -lIE '192\.168\.|10\.[0-9]+\.|[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|BEGIN [A-Z ]*PRIVATE KEY|(sk|pk)-[A-Za-z0-9_-]{20,}' \
    "$r" -- ':!package-lock.json' 2>/dev/null
done
# no output = clean

# 3. confirm .env never entered any ref
git log $PUBLISH_REFS --diff-filter=A --name-only --format= | sort -u | grep -E '^\.env$'

# 4. after pushing, prove the remote holds that set and nothing else
diff <(echo $PUBLISH_REFS | tr ' ' '\n' | sort) \
     <(git ls-remote --heads --tags origin | awk '{print $2}' \
       | sed 's|refs/heads/||;s|refs/tags/||' | sort)
```

Step 4 is the one people skip. It is what catches a stray `git push --all`, a branch pushed
by an editor's UI, or a ref that was cleaned locally after it had already been published.

Two things this scan cannot tell you, so decide them yourself:

- **Commit author emails are published with every commit** and cannot be removed without
  rewriting all of history, which invalidates every ref and every tag. If any address in
  `git log --format='%ae' $PUBLISH_REFS | sort -u` belongs to somebody else, the cheap moment
  to deal with it is before the first push, not after.
- **Deleting a local branch does not delete its objects**, but it does remove them from the
  publish set: `git push --all` and `--mirror` push refs, and an unreachable object has none.
  Deleting the branch is what closes the risk; `git gc --prune=now` only reclaims disk, and it
  destroys the last rollback path, so leave it until the material is delivered.

## Why ADVERTISE_URL exists

Each MCP server tells the orchestrator where to reach it. Inside a container `localhost` is
that container, so the advertised address must come from configuration:
`ADVERTISE_URL=http://hr:3000/mcp` names the compose service. Without it the orchestrator
registers an address it can never dial, and the failure looks like a working registration.
