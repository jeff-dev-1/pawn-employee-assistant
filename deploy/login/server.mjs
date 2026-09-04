// The form sign-in gate that sits in front of a public deployment.
//
// Why it exists: HTTP basic auth cannot be styled. The server sends a WWW-Authenticate
// header and the browser draws the dialog; there is no hook for a logo, a colour, or a line
// saying where the code came from. A designed page needs a different mechanism.
//
// Four endpoints. nginx calls /auth per request through auth_request:
//   GET  /auth    202 when the cookie is valid, 401 otherwise
//   GET  /login   the page
//   POST /login   checks the code, signs a cookie, redirects back
//   GET  /logout  clears both cookies
//
// The cookie holds an expiry and an HMAC OF that expiry - never the code itself, which
// whoever holds the cookie could otherwise forge.
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PASSWORD = process.env.PAWN_PASSWORD ?? '';
const SECRET = process.env.PAWN_COOKIE_SECRET ?? '';
const TTL_MS = Number(process.env.PAWN_TTL_HOURS ?? 12) * 3600_000;
if (!PASSWORD || !SECRET) throw new Error('PAWN_PASSWORD and PAWN_COOKIE_SECRET are required');

const sign = (v) => createHmac('sha256', SECRET).update(v).digest('base64url');
const mint = () => {
  const exp = String(Date.now() + TTL_MS);
  return exp + '.' + sign(exp);
};

/** Constant-time compare, so the comparison itself does not leak the signature. */
function same(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function valid(cookie) {
  const m = /pawn_session=([^;]+)/.exec(cookie ?? '');
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sig, sign(exp));
}

const esc = (s) =>
  String(s).replace(/[<>"&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', '&': '&amp;' })[c]);

/** The app's own sparkle, inlined: the sign-in page and what it opens are one product. */
const MARK = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor"
stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="M9.9 2.5 7.7 7.7 2.5 9.9l5.2 2.2 2.2 5.2 2.2-5.2 5.2-2.2-5.2-2.2Z"/>
<path d="M18 3v4M20 5h-4M17 17v3M18.5 18.5h-3"/></svg>`;

function page(rd, err) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Sign in &middot; PAWN Employee Assistant</title>
<style>
/* Palette sampled from the photograph rather than picked: its dominant tones are cool grey
   blues (#DFE8E9, #9C9AA6) with warm light only on the cliff face. So the panel goes cool
   white instead of the app's warm #FCFCF9, and the button goes deep green - the app's bright
   #00CC66 reads as a sticker against that sky. */
:root{--panel:#F7F9FA;--ink:#123240;--muted:#5A6E78;--line:#DFE8E9;--field:#FDFEFE;
--green:#0E7C4A;--green-hover:#0A6B3F;--red:#B23E22}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--panel);color:var(--ink);
font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;
display:grid;grid-template-columns:1fr}

/* --- the photograph --- */
.art{position:relative;overflow:hidden;background:#B1AEAF}
.art img{width:100%;height:100%;object-fit:cover;display:block;
/* 62% across, 52% down. Vertically: at 45% the soft cloud bands met the panel's edge and the
   eye drifted into a wall; the ridge line is something for that edge to land on. Horizontally:
   centred put the cliff against the boundary, and pushing right brings the water, the sails
   and the gulls into the half of the frame the reader actually looks at. */
object-position:62% 52%}
.where{position:absolute;left:28px;bottom:22px;z-index:2;color:#fff;
font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.55;
text-shadow:0 1px 8px rgba(8,24,30,.5)}

/* --- the form --- */
.side{position:relative;display:flex;align-items:center;justify-content:center;padding:32px}
/* Theme and language before signing in, not after: a reader who cannot read the page has
   no way to reach the switch that would fix it. */
.tools{position:absolute;top:20px;right:20px;display:flex;gap:8px}
.tools button{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;
border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;
transition:border-color .15s,color .15s}
.tools button:hover{border-color:var(--green);color:var(--green)}
.tools .menu{position:absolute;top:46px;right:0;display:grid;gap:2px;min-width:150px;padding:6px;
border:1px solid var(--line);border-radius:12px;background:var(--panel);
box-shadow:0 12px 30px -14px rgba(10,32,42,.4);z-index:5}
.tools .menu button{width:100%;height:auto;justify-content:flex-start;padding:8px 10px;
border:0;border-radius:8px;font-size:13.5px;color:var(--ink);text-align:left;display:flex;gap:8px}
.tools .menu button:hover{background:var(--line);color:var(--ink)}
.tools .menu button[aria-checked=true]{color:var(--green)}
.form{width:100%;max-width:360px}
.brand{display:flex;align-items:center;gap:10px;color:var(--green);margin-bottom:30px}
.brand b{color:var(--ink);font-size:20px;font-weight:600;letter-spacing:-.015em}
label{display:block;font-size:12px;color:var(--muted);margin-bottom:7px}
input{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:11px;font-size:15px;
background:var(--field);color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
input:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(14,124,74,.14)}
button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:11px;background:var(--green);
color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}
button:hover{background:var(--green-hover)}
.err{margin-top:14px;padding:10px 12px;border-radius:10px;background:rgba(178,62,34,.09);
color:var(--red);font-size:13px}

/* --- phone: the photo is the background, the form floats on it ---
   Hiding it below 1024px was the first attempt and it left a centred form in a field of
   white that reads as an error page. A portrait photo on a portrait screen does not need
   to be a sliver - it needs to be the whole thing. */
@media (max-width:1023px){
  body{grid-template-columns:1fr;grid-template-rows:1fr;position:relative}
  .art{position:fixed;inset:0;z-index:0}
  .art::after{content:'';position:absolute;inset:0;background:rgba(247,249,250,.55);
    backdrop-filter:blur(2px)}
  .side{position:relative;z-index:1;min-height:100dvh}
  .form{background:rgba(255,255,255,.93);backdrop-filter:blur(12px);
    border:1px solid rgba(255,255,255,.7);border-radius:20px;padding:30px 26px;
    box-shadow:0 18px 44px -20px rgba(10,32,42,.42)}
  .where{left:auto;right:20px;bottom:16px;z-index:2;opacity:.7}
}
@media (prefers-color-scheme:dark) and (max-width:1023px){
  .art::after{background:rgba(18,24,26,.62)}
  .form{background:rgba(24,30,33,.9);border-color:rgba(255,255,255,.09)}
}

/* --- desktop: photo left, form right, 58/42 --- */
@media (min-width:1024px){
  /* 1.618:1 - the split lands on the golden section rather than a round number. */
  body{grid-template-columns:minmax(0,1.618fr) minmax(400px,1fr)}
  /* No hard rule between them. A 1px line made the boundary a seam; a soft inner shadow on
     the panel lets the photograph fade into it. */
  .side{box-shadow:inset 14px 0 26px -18px rgba(18,50,64,.28)}
}
/* Same three-state convention as the app: the media query decides when nothing is stamped,
   an explicit choice wins in both directions. */
@media (prefers-color-scheme:dark){
:root:not([data-theme=light]){--panel:#151A1C;--ink:#E9EFF1;--muted:#93A3AA;--line:#2A3336;--field:#1B2225}}
:root[data-theme=dark]{--panel:#151A1C;--ink:#E9EFF1;--muted:#93A3AA;--line:#2A3336;--field:#1B2225}
</style>
</head>
<body>
<div class="art">
  <img src="/bg-${PHOTO ? PHOTO.length : 0}.webp" alt="" fetchpriority="high">
  <div class="where">Dianchi Lake &middot; Kunming</div>
</div>
<main class="side">
  <div class="tools" id="tools"></div>
  <div class="form">
    <div class="brand">${MARK}<b>Employee Assistant</b></div>
    <form method="post" action="/login">
      <input type="hidden" name="rd" value="${esc(rd)}">
      <label for="p">Access code</label>
      <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Enter</button>
      ${err ? '<div class="err">' + esc(err) + '</div>' : ''}
    </form>
  </div>
</main>
<script>
(() => {
  // The page is served as one file with no framework, so the switches are twenty lines of
  // DOM rather than a component. They write the same localStorage keys the app reads, so a
  // choice made here survives into the session it opens.
  const T = [['system','\u8DDF\u96A8\u7CFB\u7D71','System'],['light','\u6DFA\u8272','Light'],['dark','\u6DF1\u8272','Dark']];
  const L = [['en','English'],['zh-Hant','\u7E41\u9AD4\u4E2D\u6587']];
  // The app's own icons, inlined. Emoji rendered as flat glyphs beside a line-drawn
  // interface and read as a different product.
  const svg = (d) => '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    d + '</svg>';
  const ICON = {
    system: svg('<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>'),
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>' +
      '<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/>' +
      '<path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    dark: svg('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>'),
    lang: svg('<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>' +
      '<path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>'),
  };
  let theme = localStorage.getItem('pawn-theme') || 'system';
  let lang = localStorage.getItem('pawn-lang') || 'en';
  const zh = () => lang === 'zh-Hant';
  const root = document.documentElement;

  const apply = () => {
    root.dataset.theme = theme;
    root.lang = lang;
    localStorage.setItem('pawn-theme', theme);
    localStorage.setItem('pawn-lang', lang);
    document.querySelector('label[for=p]').textContent = zh() ? '\u5B58\u53D6\u78BC' : 'Access code';
    document.querySelector('button[type=submit]').textContent = zh() ? '\u9032\u5165' : 'Enter';
    render();
  };

  const tools = document.getElementById('tools');
  let open = null;
  function render() {
    tools.innerHTML = '';
    const add = (icon, title, items, cur, pick) => {
      const wrap = document.createElement('span');
      wrap.style.position = 'relative';
      const b = document.createElement('button');
      b.type = 'button'; b.title = title; b.innerHTML = icon;
      b.onclick = (e) => { e.stopPropagation(); open = open === title ? null : title; render(); };
      wrap.appendChild(b);
      if (open === title) {
        const m = document.createElement('span');
        m.className = 'menu';
        items.forEach(([id, label]) => {
          const i = document.createElement('button');
          i.type = 'button'; i.textContent = label;
          i.setAttribute('aria-checked', String(id === cur));
          i.onclick = (e) => { e.stopPropagation(); pick(id); open = null; apply(); };
          m.appendChild(i);
        });
        wrap.appendChild(m);
      }
      tools.appendChild(wrap);
    };
    add(ICON[theme], zh() ? '\u4E3B\u984C' : 'Theme',
        T.map(([id, z, e]) => [id, zh() ? z : e]), theme, (v) => { theme = v; });
    add(ICON.lang, zh() ? '\u8A9E\u8A00' : 'Language', L, lang, (v) => { lang = v; });
  }
  document.addEventListener('click', () => { if (open) { open = null; render(); } });
  apply();
})();
</script>
</body>
</html>`;
}

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };

// The photograph, read once at boot. 150 KB is small enough to hold in memory and saves a
// filesystem hit per sign-in; it is also small enough that the page does not wait on it.
let PHOTO = null;
try {
  PHOTO = readFileSync(new URL('./login-bg.webp', import.meta.url));
} catch {
  // No photo, no split screen - the page falls back to the centred card. A missing asset
  // must not take the gate down.
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');

  // The path carries the byte length as a version. Without it the week-long cache header
  // means a replaced photograph keeps serving the old one, which is how the first sharper
  // upload appeared to do nothing.
  if (url.pathname.startsWith('/bg') && url.pathname.endsWith('.webp') && PHOTO) {
    res.writeHead(200, { 'content-type': 'image/webp', 'cache-control': 'public, max-age=604800' });
    return res.end(PHOTO);
  }

  if (url.pathname === '/auth') {
    res.writeHead(valid(req.headers.cookie) ? 202 : 401);
    return res.end();
  }

  if (url.pathname === '/login' && req.method === 'GET') {
    res.writeHead(200, HTML);
    return res.end(page(url.searchParams.get('rd') || '/', ''));
  }

  if (url.pathname === '/login' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 4096) req.destroy();
    });
    return req.on('end', () => {
      const f = new URLSearchParams(body);
      // Relative paths only, or the sign-in page becomes an open redirect: the link
      // shows your domain and lands somewhere else.
      const raw = f.get('rd') || '/';
      const rd = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
      if (!same(f.get('password') ?? '', PASSWORD)) {
        res.writeHead(401, HTML);
        return res.end(page(rd, 'That code is not right.'));
      }
      res.writeHead(302, {
        // Two cookies: the signed session, which JavaScript must never read, and a flag
        // that carries no secret and exists only so the app knows a gate is in front of it
        // and can offer a sign-out control. Reading HttpOnly from JS is impossible by
        // design, and weakening the session cookie to make a button appear would be a bad
        // trade.
        'set-cookie': [
          `pawn_session=${mint()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL_MS / 1000}`,
          `pawn_gate=1; Path=/; Secure; SameSite=Lax; Max-Age=${TTL_MS / 1000}`,
        ],
        location: rd,
      });
      res.end();
    });
  }

  if (url.pathname === '/logout') {
    res.writeHead(302, {
      'set-cookie': [
        'pawn_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
        'pawn_gate=; Path=/; Secure; SameSite=Lax; Max-Age=0',
      ],
      location: '/',
    });
    return res.end();
  }

  res.writeHead(404);
  res.end();
}).listen(4181, '0.0.0.0');
