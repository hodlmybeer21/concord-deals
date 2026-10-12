// GET shows confirmation; POST (RFC 8058 List-Unsubscribe-Post one-click) also works. Token never expires.
const E = require('../lib/email'); const { html, json, query } = require('./_util');
module.exports = async (req, res) => {
  const p = E.verify(query(req).get('token') || '', process.env.EMAIL_TOKEN_SECRET, 'u');
  if (!p) return req.method === 'POST' ? json(res, 400, { ok: false }) : html(res, 400, E.page('That link didn’t work', '<p>This unsubscribe link is invalid. Reply to any NH Cart email and we’ll remove you by hand.</p>', false));
  if (E.missingEnv(['audience']).length) return req.method === 'POST' ? json(res, 503, { ok: false }) : html(res, 503, E.page('Try again shortly', '<p>We couldn’t reach our mailing list just now. Please try again later.</p>', false));
  try { await E.setUnsubscribed(p.e); } catch (e) { console.error(e.message); if (e.status !== 404) return req.method === 'POST' ? json(res, 502, { ok: false }) : html(res, 502, E.page('Something went wrong', '<p>Please try the link again in a minute.</p>', false)); }
  if (req.method === 'POST') return json(res, 200, { ok: true });
  return html(res, 200, E.page('You’re unsubscribed', `<p><b>${E.esc(p.e)}</b> won’t get any more NH Cart emails.</p><p>Changed your mind? You can sign up again on the site any time.</p>`));
};
