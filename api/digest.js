// Weekly digest. Auth: Authorization: Bearer $CRON_SECRET (Vercel Cron sends this) or ?key=.
// ?dry=1 renders the email (HTML, or ?format=text|json) without sending. Without dry it sends to confirmed, subscribed contacts.
const E = require('../lib/email'); const { buildDigest } = require('../lib/digest'); const { json, query } = require('./_util');
module.exports = async (req, res) => {
  const q = query(req), dry = q.get('dry') === '1';
  if (!process.env.CRON_SECRET) return json(res, 503, { ok: false, error: 'CRON_SECRET not set; digest disabled' });
  const auth = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}` || q.get('key') === process.env.CRON_SECRET;
  if (!auth) return json(res, 401, { ok: false, error: 'unauthorized' });
  const d = await buildDigest();
  if (dry) { const m = E.digestEmail(d, `${E.SITE}/api/unsubscribe?token=SAMPLE`); const f = q.get('format');
    if (f === 'json') return json(res, 200, { ok: true, dry: true, subject: m.subject, digest: d, missing: E.missingEnv(['send', 'audience']) });
    res.setHeader('Content-Type', f === 'text' ? 'text/plain; charset=utf-8' : 'text/html; charset=utf-8'); return res.status(200).end(f === 'text' ? m.text : m.html); }
  if (q.get('test') === '1') { // pre-launch test: one email to the hardcoded test address only, no postal line
    const miss = E.missingEnv(['send']); if (miss.length) return json(res, 503, { ok: false, sent: 0, error: 'missing env, nothing sent', missing: miss });
    const u = `${E.SITE}/api/unsubscribe?token=${encodeURIComponent(E.unsubToken(E.TEST_TO, process.env.EMAIL_TOKEN_SECRET))}`; const m = E.digestEmail(d, u, process.env, true);
    try { const r = await E.resend('/emails', 'POST', { from: `NH Cart <${process.env.MAIL_FROM}>`, to: [E.TEST_TO], reply_to: E.REPLY_TO(), subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${u}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
      return json(res, 200, { ok: true, test: true, sent: 1, to: E.TEST_TO, id: r.id }); } catch (e) { return json(res, 502, { ok: false, sent: 0, error: e.message }); } }
  if (E.missingEnv(['postal']).length) return json(res, 503, { ok: false, sent: 0, error: 'postal address required' });
  const miss = E.missingEnv(['send', 'audience']); if (miss.length) return json(res, 503, { ok: false, sent: 0, error: 'missing env, nothing sent', missing: miss });
  const to = await E.activeContacts(); let sent = 0; const fails = [];
  for (let i = 0; i < to.length; i += 100) {
    const batch = to.slice(i, i + 100).map(email => { const u = `${E.SITE}/api/unsubscribe?token=${encodeURIComponent(E.unsubToken(email, process.env.EMAIL_TOKEN_SECRET))}`; const m = E.digestEmail(d, u);
      return { from: `NH Cart <${process.env.MAIL_FROM}>`, to: [email], reply_to: E.REPLY_TO(), subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${u}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }; });
    try { await E.resend('/emails/batch', 'POST', batch); sent += batch.length; } catch (e) { fails.push(e.message); }
  }
  return json(res, fails.length ? 207 : 200, { ok: !fails.length, sent, recipients: to.length, errors: fails });
};
