// NH Cart weekly email: tokens, env checks, Resend calls, templates. Fails safe: nothing is sent unless every required env var is set.
const crypto = require('crypto');
const SITE = process.env.SITE_URL || 'https://concord-deals.vercel.app';
const REQUIRED = { send: ['RESEND_API_KEY', 'MAIL_FROM', 'MAIL_POSTAL_ADDRESS', 'EMAIL_TOKEN_SECRET'], audience: ['RESEND_API_KEY', 'RESEND_AUDIENCE_ID', 'EMAIL_TOKEN_SECRET'], cron: ['CRON_SECRET'] };
function missingEnv(groups, env = process.env) { const m = new Set(); for (const g of groups) for (const k of REQUIRED[g]) if (!env[k] || !String(env[k]).trim()) m.add(k); return [...m]; }
const b64u = b => Buffer.from(b).toString('base64url');
function sign(payload, secret) { if (!secret) throw new Error('EMAIL_TOKEN_SECRET missing'); const body = b64u(JSON.stringify(payload)); return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url'); }
function verify(token, secret, purpose, now = Date.now()) {
  if (!secret || typeof token !== 'string' || !token.includes('.')) return null; const [body, sig] = token.split('.');
  const exp = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!sig || sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (purpose && p.p !== purpose) return null; if (p.x && now > p.x) return null; return p;
}
const validEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-z]{2,}$/i.test(e);
const confirmToken = (email, secret) => sign({ p: 'c', e: email.toLowerCase(), x: Date.now() + 72 * 36e5 }, secret);
const unsubToken = (email, secret) => sign({ p: 'u', e: email.toLowerCase() }, secret); // no expiry: unsubscribe links must keep working
// ---- Resend REST (https://resend.com/docs/api-reference) ----
async function resend(path, method, body, env = process.env) {
  const r = await fetch('https://api.resend.com' + path, { method, headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { raw: t }; } if (!r.ok) { const e = new Error(`Resend ${method} ${path} ${r.status}: ${j.message || t}`); e.status = r.status; throw e; } return j;
}
const aud = env => `/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`;
async function upsertContact(email, unsubscribed, env = process.env) {
  try { return await resend(aud(env), 'POST', { email, unsubscribed }, env); }
  catch (e) { if (e.status === 409 || e.status === 422) return resend(`${aud(env)}/${encodeURIComponent(email)}`, 'PATCH', { unsubscribed }, env); throw e; }
}
const setUnsubscribed = (email, env = process.env) => resend(`${aud(env)}/${encodeURIComponent(email)}`, 'PATCH', { unsubscribed: true }, env);
async function activeContacts(env = process.env) { const j = await resend(aud(env), 'GET', null, env); return (j.data || []).filter(c => !c.unsubscribed).map(c => c.email); }
// ---- templates ----
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const POSTAL_PLACEHOLDER = '[MAIL_POSTAL_ADDRESS not set: your physical postal address goes here]';
const MARK = `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0f7a43;border-radius:10px;width:36px;height:36px;text-align:center;color:#fff;font:800 15px Arial,sans-serif">🛒</td><td style="padding-left:10px;font:800 20px Arial,Helvetica,sans-serif;color:#0f1a16">NH <span style="color:#0f7a43">Cart</span></td></tr></table>`;
function layout({ title, preheader, body, footer }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<style>body{margin:0;background:#f3f5f4}a{color:#0f7a43}.c{max-width:600px}@media (max-width:620px){.p{padding:18px 16px!important}.h1{font-size:22px!important}}
@media (prefers-color-scheme:dark){body,.bg{background:#0b1210!important}.card{background:#121b18!important;border-color:#24322d!important}.t,.t td{color:#eef4f1!important}.m{color:#a3b3ad!important}a{color:#34c47c!important}}</style></head>
<body><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f3f5f4"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="c" style="max-width:600px"><tr><td style="padding:4px 6px 14px">${MARK}</td></tr>
<tr><td class="card p t" style="background:#ffffff;border:1px solid #e3e8e6;border-radius:18px;padding:26px 28px;font:15px/1.5 Arial,Helvetica,sans-serif;color:#0f1a16">${body}</td></tr>
<tr><td class="m" style="padding:18px 10px;font:12px/1.55 Arial,Helvetica,sans-serif;color:#5d6b66">${footer}</td></tr></table></td></tr></table></body></html>`;
}
const btn = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0"><tr><td style="background:#0f7a43;border-radius:12px"><a href="${esc(href)}" style="display:inline-block;padding:14px 22px;font:700 16px Arial,sans-serif;color:#ffffff;text-decoration:none">${esc(label)}</a></td></tr></table>`;
function footerHtml(env, reason, unsubUrl) {
  const addr = env.MAIL_POSTAL_ADDRESS || POSTAL_PLACEHOLDER;
  return `${esc(reason)}<br>${unsubUrl ? `<a href="${esc(unsubUrl)}">Unsubscribe</a> with one click, any time.<br>` : ''}Sent by NH Cart (${esc(env.MAIL_FROM || 'deals@nhcart.goodbotai.tech')}), ${esc(addr)}.<br>Prices come from weekly store flyers (currently sourced for the Concord, NH area, 03301); always check the flyer before you buy.`;
}
function footerText(env, reason, unsubUrl) { return `--\n${reason}\n${unsubUrl ? 'Unsubscribe (one click): ' + unsubUrl + '\n' : ''}Sent by NH Cart (${env.MAIL_FROM || 'deals@nhcart.goodbotai.tech'}), ${env.MAIL_POSTAL_ADDRESS || POSTAL_PLACEHOLDER}.\nPrices come from weekly store flyers (currently sourced for the Concord, NH area, 03301).`; }
function confirmEmail(email, url, env = process.env) {
  const reason = `You (or someone using ${email}) asked for the NH Cart weekly email at ${SITE}. If that wasn't you, ignore this and you won't hear from us again.`;
  return { subject: 'Confirm your NH Cart weekly email', html: layout({ title: 'Confirm your subscription', preheader: 'One tap to start getting the NH Cart weekly deals.', footer: footerHtml(env, reason, null),
    body: `<h1 class="h1 t" style="margin:0 0 10px;font-size:24px">Confirm your email</h1><p style="margin:0">Tap below to start the NH Cart weekly email: the best flyer deals at Market Basket, Hannaford, Aldi, Shaw's, Sam's Club and Walmart, plus this week's cheapest meals. Twice a week at most.</p>${btn(url, 'Yes, send me the weekly deals')}<p class="m" style="margin:0;font-size:13px;color:#5d6b66">This link expires in 72 hours. Or paste it into your browser:<br><a href="${esc(url)}" style="word-break:break-all">${esc(url)}</a></p>` }),
    text: `Confirm your NH Cart weekly email\n\nOpen this link to start getting the best flyer deals and this week's cheapest meals (twice a week at most):\n${url}\n\nThe link expires in 72 hours.\n\n${footerText(env, reason, null)}` };
}
function digestEmail(d, unsubUrl, env = process.env) {
  const reason = 'You get this because you subscribed to the NH Cart weekly email and confirmed your address.';
  const money = n => '$' + Number(n).toFixed(2);
  let body = `<h1 class="h1 t" style="margin:0 0 4px;font-size:24px">This week's NH Cart deals</h1><p class="m" style="margin:0 0 16px;color:#5d6b66;font-size:13px">${esc(d.range)} · flyer prices fetched ${esc(d.fetched)} ET. Only deals with a confirmed unit. No savings figures: the flyers don't list regular prices.</p>`;
  let text = `This week's NH Cart deals\n${d.range} · flyer prices fetched ${d.fetched} ET. Only deals with a confirmed unit; no savings figures (flyers don't list regular prices).\n`;
  for (const s of d.stores) {
    body += `<h2 class="t" style="margin:18px 0 6px;font-size:17px">${esc(s.store)} <span class="m" style="font-weight:400;font-size:12px;color:#5d6b66">${esc(s.dates)}</span></h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">`;
    text += `\n${s.store.toUpperCase()} (${s.dates})\n`;
    if (!s.deals.length) { const msg = s.available ? 'No meal-ingredient deals with a confirmed unit this week.' : 'Flyer unavailable this week.'; body += `<tr><td class="m" style="color:#5d6b66;font-size:14px;padding:6px 0">${msg}${s.flyer ? ` <a href="${esc(s.flyer)}">Browse the flyer</a>` : ''}</td></tr>`; text += `  ${msg}${s.flyer ? ' Flyer: ' + s.flyer : ''}\n`; }
    for (const x of s.deals) { const mb = /^\d+\s*\/\s*\$/.test(x.unit), pt = mb ? x.unit : x.price_text, ut = mb ? 'multi-buy' : '/ ' + x.unit;
      body += `<tr><td style="padding:8px 0;border-top:1px solid #e3e8e6;font-size:14px" class="t">${esc(x.item)}<br><span class="m" style="color:#5d6b66;font-size:12px">${esc(x.why)} · <span style="text-transform:uppercase;font-weight:700;letter-spacing:.3px">${esc(x.source)}</span> · <a href="${esc(x.source_url)}">source</a></span></td><td align="right" valign="top" style="padding:8px 0 8px 10px;border-top:1px solid #e3e8e6;white-space:nowrap;font:800 16px Arial,sans-serif" class="t">${esc(pt)}<br><span class="m" style="font:400 12px Arial,sans-serif;color:#5d6b66">${esc(ut)}</span></td></tr>`;
      text += `  - ${x.item}: ${pt} ${ut} [${x.source}] ${x.source_url}\n`;
    }
    body += '</table>';
  }
  body += `<h2 class="t" style="margin:24px 0 6px;font-size:17px">5 cheapest meals this week (serves 4)</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">`;
  text += `\n5 CHEAPEST MEALS (serves 4)\n`;
  for (const m of d.meals) { body += `<tr><td style="padding:8px 0;border-top:1px solid #e3e8e6;font-size:15px" class="t"><a href="${esc(m.url)}" style="font-weight:700;text-decoration:none">${esc(m.name)}</a><br><span class="m" style="color:#5d6b66;font-size:12px">${esc(m.stores)}${m.partial ? ' · partial total, some items unpriced' : ''}${m.est ? ' · includes BLS regular-price estimate' : ''}</span></td><td align="right" valign="top" style="padding:8px 0;border-top:1px solid #e3e8e6;font:800 16px Arial,sans-serif;color:#0f7a43">${money(m.total)}${m.partial ? '+' : ''}</td></tr>`;
    text += `  - ${m.name}: ${money(m.total)}${m.partial ? '+ (partial)' : ''} · ${m.stores} · ${m.url}\n`; }
  body += `</table>${btn(SITE + '/#meals', 'Open NH Cart')}`; text += `\nOpen NH Cart: ${SITE}\n`;
  return { subject: `NH Cart: ${d.headline}`, html: layout({ title: 'NH Cart weekly deals', preheader: d.headline, body, footer: footerHtml(env, reason, unsubUrl) }), text: text + '\n' + footerText(env, reason, unsubUrl) };
}
function page(title, msg, ok = true) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · NH Cart</title><link rel="icon" href="/icons/favicon-32.png"><meta name="theme-color" content="#0f7a43">
<style>:root{--bg:#f3f5f4;--s:#fff;--l:#e3e8e6;--t:#0f1a16;--m:#5d6b66;--a:#0f7a43;--ai:#fff;--as:#e6f5ec}@media (prefers-color-scheme:dark){:root{--bg:#0b1210;--s:#121b18;--l:#24322d;--t:#eef4f1;--m:#a3b3ad;--a:#34c47c;--ai:#04130b;--as:#11291d}}
body{margin:0;background:var(--bg);color:var(--t);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}.w{max-width:520px;margin:0 auto;padding:28px 16px}.b{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px}.b i{width:36px;height:36px;border-radius:11px;background:var(--a);display:grid;place-items:center;font-style:normal}.b span{color:var(--a)}
.c{margin-top:22px;background:var(--s);border:1px solid var(--l);border-radius:20px;padding:26px 22px}.ic{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:var(--as);margin-bottom:12px}h1{margin:0 0 8px;font-size:23px;letter-spacing:-.3px}p{margin:0 0 12px;color:var(--m)}
a.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:14px;background:var(--a);color:var(--ai);font-weight:700;text-decoration:none;margin-top:16px}</style></head>
<body><div class="w"><div class="b"><i>🛒</i>NH <span>Cart</span></div><div class="c"><div class="ic">${ok ? '✓' : '!'}</div><h1>${esc(title)}</h1>${msg}<a class="btn" href="/">Open NH Cart</a></div></div></body></html>`;
}
module.exports = { SITE, REQUIRED, missingEnv, sign, verify, validEmail, confirmToken, unsubToken, resend, upsertContact, setUnsubscribed, activeContacts, confirmEmail, digestEmail, page, esc, POSTAL_PLACEHOLDER };
