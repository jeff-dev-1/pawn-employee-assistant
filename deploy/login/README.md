# The sign-in gate

A public URL for this demo means anyone can spend the gateway key, and the demo's premise is
*"try to inject me"*, so a gate is not optional. This is the smallest one that is not the
browser's own dialog.

Why it exists at all: HTTP basic auth cannot be styled. The server sends a `WWW-Authenticate`
header and the browser draws the box; there is no hook for a logo, a colour, or a sentence
saying where the code comes from. A designed sign-in page needs a different mechanism.

## What it is

One file, no dependencies, three endpoints behind nginx's `auth_request`:

```
GET  /auth    202 when the cookie is valid, 401 otherwise - nginx asks this per request
GET  /login   the page
POST /login   checks the code, signs a cookie, redirects back
GET  /logout  clears both cookies
```

The cookie holds an expiry and an HMAC **of that expiry** - never the code itself, which
whoever holds it could otherwise forge. A second cookie, `pawn_gate`, carries no secret and
exists only so the app can tell it is behind a gate and offer a sign-out control: the session
cookie is HttpOnly and unreadable from JavaScript by design, and weakening it to make a
button appear would be a bad trade.

## Running it

```bash
scp server.mjs login-bg.webp root@$EDGE:/opt/pawn-login/
# /opt/pawn-login/pawn-login.env:
#   PAWN_PASSWORD=...        the shared code
#   PAWN_COOKIE_SECRET=...   openssl rand -base64 32
#   PAWN_TTL_HOURS=168
systemctl restart pawn-login
```

`docs/DEPLOY.md` carries the nginx side, including the two rules that are easy to get wrong:
the ACME challenge path and the login page's own assets must both sit **outside** the gate.
Miss the first and certificate renewal fails silently ninety days later; miss the second and
the gate redirects the background image to the page that is asking for it.

## The photograph

`login-bg.webp` is 2075x2500, cropped from a 3024x4032 original to 0.83 - the ratio the left
panel lands on across common desktop sizes - and quality 86, which is 309 KB. Two earlier
attempts are worth not repeating: 1800px wide is too small for a 2x display and visibly soft,
and quality 68 puts banding in a sky that is mostly gradient.

The panel's palette is sampled from the file rather than chosen. Its dominant tones are cool
grey blues, so the form sits on `#F7F9FA` instead of the app's warm `#FCFCF9`, and the button
is `#0E7C4A` rather than the app's `#00CC66` - bright green against that sky reads as a
sticker stuck onto the photograph.

Replacing it: the served path carries the byte length as a version (`/bg-316690.webp`).
Without that the week-long cache header means a new photograph keeps serving the old one,
which is how the first sharper upload appeared to do nothing at all.
