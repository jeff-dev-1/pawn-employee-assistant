// pawn.imilos.com 的表单登录闸门。
//
// 存在的理由：HTTP basic auth 的对话框是浏览器 chrome 的一部分，服务端只能发一个
// WWW-Authenticate 头，改不了样式。要一个设计过的登录页就必须换机制。
//
// 三个端点，nginx 通过 auth_request 使用 /auth：
//   GET  /login  设计过的表单
//   POST /login  校验口令，签一个 HMAC cookie，跳回来路
//   GET  /auth   cookie 有效返回 202，否则 401（nginx 据此放行或跳转）
//
// cookie 是 HMAC 签名的过期时间戳，不是"把口令存进 cookie"——后者任何人都能伪造。
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

/** 定长比较，避免用比较耗时泄漏签名。 */
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

/** 应用里那颗 sparkle，内联成 SVG——登录页和落地页应该是同一个东西。 */
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
/* 52%, not 45%: at 45% the soft horizontal cloud bands sat against the panel's empty white
   and the eye drifted across into a wall. Dropping the crop puts the ridge line on the
   boundary instead, which is something for the edge to land on. */
object-position:50% 52%}
.where{position:absolute;left:28px;bottom:22px;z-index:2;color:#fff;
font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.55;
text-shadow:0 1px 8px rgba(8,24,30,.5)}

/* --- the form --- */
.side{display:flex;align-items:center;justify-content:center;padding:32px}
.form{width:100%;max-width:360px}
.brand{display:flex;align-items:center;gap:10px;color:var(--green);margin-bottom:34px}
.brand b{color:var(--ink);font-size:18px;font-weight:600;letter-spacing:-.01em}
h1{margin:0 0 6px;font-size:23px;letter-spacing:-.015em}
p.sub{margin:0 0 26px;color:var(--muted);font-size:14px}
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
  body{grid-template-columns:minmax(0,58fr) minmax(420px,42fr)}
  /* No hard rule between them. A 1px line made the boundary a seam; a soft inner shadow on
     the panel lets the photograph fade into it. */
  .side{box-shadow:inset 14px 0 26px -18px rgba(18,50,64,.28)}
}
@media (prefers-color-scheme:dark){
:root{--panel:#151A1C;--ink:#E9EFF1;--muted:#93A3AA;--line:#2A3336;--field:#1B2225}}
</style>
</head>
<body>
<div class="art">
  <img src="/bg-${PHOTO ? PHOTO.length : 0}.webp" alt="" fetchpriority="high">
  <div class="where">Dianchi Lake &middot; Kunming</div>
</div>
<main class="side">
  <div class="form">
    <div class="brand">${MARK}<b>PAWN Assistant</b></div>
    <h1>Employee Assistant</h1>
    <p class="sub">Sign in to continue.</p>
    <form method="post" action="/login">
      <input type="hidden" name="rd" value="${esc(rd)}">
      <label for="p">Access code</label>
      <input id="p" name="password" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Enter</button>
      ${err ? '<div class="err">' + esc(err) + '</div>' : ''}
    </form>
  </div>
</main>
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
      // 只接受站内相对路径，否则登录页会变成一个开放重定向。
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
