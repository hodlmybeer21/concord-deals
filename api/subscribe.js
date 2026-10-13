// POST {email, website(honeypot), t(form render ms)} -> sends a double opt-in confirm email. Nothing is stored until the link is clicked.
const E = require('../lib/email'); const { readBody, json } = require('./_util');
const HITS = new Map(); // best-effort per-instance rate limit: 5 requests / 10 min per IP
function limited(ip) { const now = Date.now(), a = (HITS.get(ip) || []).filter(t => now - t < 6e5); a.push(now); HITS.set(ip, a); return a.length > 5; }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const b = await readBody(req); const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  if (limited(ip)) return json(res, 429, { ok: false, error: 'Too many attempts. Try again in a few minutes.' });
  if (b.website) return json(res, 200, { ok: true }); // honeypot: pretend success
  if (b.t && Date.now() - Number(b.t) < 1500) return json(res, 200, { ok: true }); // submitted faster than a human
  const email = String(b.email || '').trim().toLowerCase();
  if (!E.validEmail(email)) return json(res, 400, { ok: false, error: 'Please enter a valid email address.' });
  const miss = E.missingEnv(['send', 'audience']);
  if (miss.length) { console.error('subscribe disabled, missing env:', miss.join(', ')); return json(res, 503, { ok: false, error: 'Email signup isn’t switched on yet. Please check back soon.', missing: miss }); }
  if (E.missingEnv(['postal']).length) return json(res, 503, { ok: false, error: 'Signups are opening soon. Please check back in a few days.', reason: 'postal address required' });
  const url = `${E.SITE}/api/confirm?token=${encodeURIComponent(E.confirmToken(email, process.env.EMAIL_TOKEN_SECRET))}`;
  const m = E.confirmEmail(email, url);
  try { await E.resend('/emails', 'POST', { from: `NH Cart <${process.env.MAIL_FROM}>`, to: [email], reply_to: E.REPLY_TO(), subject: m.subject, html: m.html, text: m.text }); }
  catch (e) { console.error(e.message); return json(res, 502, { ok: false, error: 'Couldn’t send the confirmation email. Please try again later.' }); }
  return json(res, 200, { ok: true });
};
