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
git rev-parse main | ssh root@$HOST 'cat > /data/pawn-employee-assistant/DEPLOYED'
ssh root@$HOST 'cd /data/pawn-employee-assistant && cp -n .env.example .env && docker compose up -d --build'
```

`git archive` sends the tracked tree only — no `node_modules`, no `.git`, about 700 KB.

The third line is worth the three seconds. Because `.git` is not sent, **nothing on the node
can tell you which commit is running** — `git rev-parse HEAD` there reports
`bad default revision 'HEAD'`, and the files look plausible whatever their age. That was not
hypothetical: a deployment sat for 39 hours serving code from before a day of changes, with
an `.env` that had been given new variables the running code did not read. Write the sha down
and `cat DEPLOYED` answers the question in one command:

```bash
ssh root@$HOST 'cat /data/pawn-employee-assistant/DEPLOYED'   # compare with `git rev-parse main`
```

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
  git grep -lIE '\b(192\.168|10|172\.(1[6-9]|2[0-9]|3[01]))\.[0-9]{1,3}\.[0-9]{1,3}\b|BEGIN [A-Z ]*PRIVATE KEY|(sk|pk)-[A-Za-z0-9_-]{20,}' \
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

**What this pattern cannot do, and do not try to make it.** A prose reference carrying only
part of an address — the last two octets of a lab host, dropped into a sentence — went into
this repository and survived a scan written to prevent exactly that. The obvious fix is to
widen the pattern to three octets. Do not: `1.30.0` and `16.3.3` match it, so does every
version string in the tree, and the scan lights up on a hundred and fifty files. **A scanner
that is always red is the same as no scanner**, and the second failure is worse than the
first because it looks like diligence.

A regular expression can catch the mechanical cases: whole private addresses, key shapes,
`.env` entering a ref. It cannot catch a fragment in a sentence, because a fragment in a
sentence is indistinguishable from a version number. That case is caught by **reading the
file**, which is why `docs/INSTRUCTOR.md`'s pre-class checklist ends with reading the runbook
end to end, and why this one was found while translating rather than while scanning.

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

---

# Putting it on a public URL

The demo runs on a lab node behind a VPN. A public link needs a machine with a real address —
but not one that runs the application. `$LAB` is the node with the stack; `$EDGE` is a small
public host that already terminates TLS for something else.

## Reverse tunnel, not a second deployment

The first instinct is to deploy the stack onto the public host. Measure before you do:
two full stacks are about **735 MiB** at runtime, which fits almost anywhere, but
`next build` on a 2-core / 1.8 GB box **with no swap** is what actually kills you, and the
images are ~950 MB each so shipping them over a laptop is not the answer either.

So put nothing on the edge. The lab node opens a reverse tunnel and nginx proxies into it:

```
$LAB:3010  ──reverse ssh──▶  $EDGE 127.0.0.1:18081  ──nginx──▶  https://demo.example.com
```

The three MCP servers and the gateway key never leave the lab network; the edge sees one
HTTP port. On the lab node:

```ini
# /etc/systemd/system/pawn-tunnel.service
ExecStart=/usr/bin/ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
  -i /root/.ssh/tunnel_key -R 127.0.0.1:18081:localhost:3010 root@$EDGE
Restart=always
```

**The tunnel key is restricted, and that is why your second tunnel fails.** A key issued for
one forward carries `permitlisten` for exactly that port:

```
restrict,port-forwarding,permitlisten="127.0.0.1:18080" ssh-ed25519 AAAA... tunnel
```

`ExitOnForwardFailure=yes` then makes ssh exit, systemd restarts it, and `systemctl is-active`
says `activating` forever while the port never binds. The log line to look for is
`Remote: port forwarding refused`. Add the new port to that key's options — never widen it to
unrestricted forwarding.

## The gate

A public URL for this demo means anyone can spend the gateway key, and the demo's whole
premise is *"try to inject me"*, so abuse is the expected case rather than the accident.
Four modes, one symlink, switched by `pawn-auth-mode`:

| Mode | What it is | When |
|---|---|---|
| `form` | A login page we serve, HMAC-signed cookie | Default. A designed page instead of the browser's dialog |
| `basic` | HTTP basic auth | The classroom fallback: one command, thirty seconds |
| `sso` | oauth2-proxy → an OIDC provider | Long-running instances, when you want identity |
| `open` | No gate | Only once the key itself has a spend cap |

The switch does `nginx -t` before reloading and rolls back if it fails — on a demo day the
one unacceptable outcome is a gate change that takes the site down. `sso` additionally
refuses to activate when its client id is unset or its service is not running, because both
of those are discovered at the worst possible moment otherwise.

Three things that are easy to get wrong:

- **Keep `/.well-known/acme-challenge/` outside the gate.** It lives in the port-80 server
  block; if the gate reaches it, renewal fails silently and you find out in ninety days.
- **Validate the post-login redirect.** `?rd=https://evil.example/` turns a login page into an
  open redirect: the link shows your domain and lands somewhere else. Accept relative paths
  only, and reject `//host` as well as absolute URLs.
- **Sign the cookie, do not store the secret in it.** The cookie holds an expiry plus an HMAC
  of that expiry; anything else is forgeable by whoever holds it.

**A gate is not a spend limit.** A shared code stops crawlers and strangers; it does not stop
the twenty people who have it. The control that bounds the bill is a cap on the gateway key
itself, and it is a separate task from any of this.

## The spend cap, which is the only control that bounds the bill

Four layers end up in front of a public demo, and only the last one is about money:

| Layer | Stops |
|---|---|
| The login gate | Crawlers and strangers |
| nginx `limit_req` (5 r/s, burst 10) | Scripts |
| Gateway key rate limit (200 requests/day) | Sustained abuse |
| **Gateway key budget** | **The bill** |

200 requests/day is about 100 exchanges — two model calls each — which is twenty people
asking five questions. Past that the key refuses, and the demo is down rather than expensive.

Make a **second key** for the public deployment, never the one on your laptop, so revoking it
costs you nothing. On the key: a rate limit, a cost budget, an alert threshold below it, and
a monthly reset so the key does not die permanently the first time a crawler finds you.

**Leave the key's Config field empty.** Binding the guardrail config to the credential is the
safer posture in production and is appendix D — but this demo's whole point is that modes 2
and 3 differ by whether `x-portkey-config` is sent, and a config bound to the key is sent on
every request. Mode 2 and mode 3 then behave identically and appendix B has nothing to show.
The guardrail is not weakened by this: protected mode still sends the config and still gets a
446. Note that "allow config override" does not rescue it either, because mode 2 sends *no*
header, and no header means the key's default applies.

Two things the form will not tell you:

- **A budget cannot be edited after the key is created.** Changing it means duplicating the
  key. Decide the number once; do not set a small one to test the flow.
- `Validation failed: undefined: Invalid value` on create is a **field** problem, not a
  permission problem — most often a periodic-reset option whose date field is still empty.
  Turn the budget block off, create, and add it back to find which field it is.

Swapping the key is three commands and one verification, and the verification is the point:

```bash
cp .env .env.bak-key-$(date +%m%d-%H%M)
sed -i 's|^PORTKEY_API_KEY=.*|PORTKEY_API_KEY=<new>|' .env
docker compose up -d web        # the MCP servers do not read this variable
```

Then ask one question in each of the three modes through the public URL and compare against
what they did before. A key swap that quietly changes behaviour — a config bound to the new
credential, a permission the old key had — looks exactly like a key swap that worked:

```
mode 1 normal     plan: [hr.find_employee]     an answer
mode 2 risky      plan: []                     the planner refuses
mode 3 protected  guardrail                    detected: [injection]
```

## SSE will not survive a default proxy

```nginx
location / {
    proxy_pass http://127.0.0.1:18081;
    proxy_read_timeout 300s;   # the writer streams for longer than the 60s default
    proxy_buffering    off;    # or the whole answer arrives at once, looking like a hang
    proxy_cache        off;
}
```

Without those two lines the demo looks broken in the way that is hardest to diagnose: it
works, eventually, all at once.

## Which commit is actually running

`git archive` deliberately omits `.git`, so `git rev-parse HEAD` on the node reports
`bad default revision 'HEAD'` and stale files look exactly like fresh ones. Stamp it:

```bash
git rev-parse main | ssh root@$LAB 'cat > /data/pawn-employee-assistant/DEPLOYED'
ssh root@$LAB 'cat /data/pawn-employee-assistant/DEPLOYED'   # compare with git rev-parse main
```

A deployment once served code from 39 hours earlier while its `.env` had been given three new
variables the running code did not read. Nothing looked wrong.

## Two stacks side by side

`container_name` is hard-coded in `docker-compose.yml`, so `-p` alone is not enough — the
second stack collides on names, not on ports. An override file fixes both:

```yaml
# docker-compose.override.yml, in the second checkout
services:
  web:    { container_name: pawn-demo-web }
  hr:     { container_name: pawn-demo-hr }
  it:     { container_name: pawn-demo-it }
  policy: { container_name: pawn-demo-policy }
```

with `WEB_PORT`/`HR_PORT`/`IT_PORT`/`POLICY_PORT` moved in that checkout's `.env`, started as
`docker compose -p pawn-demo up -d --build`.

## Before a cohort

- `cat DEPLOYED` on every node, compare with `git rev-parse`.
- One real question end to end **through the public URL**, and read the time to first token.
  A slow vendor is indistinguishable from a broken proxy until you time it: one writer took
  24.6 s to first byte and 4.9 s after switching vendors, with no configuration change on the
  edge at all.
- If the gate is `sso` and the provider mails a code: **have five people log in within the
  same minute.** Hosted senders are rate-limited and corporate mail gateways filter bulk
  one-time codes. This failure only appears with an audience — a single test always arrives.
