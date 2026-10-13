const E = require('../lib/email'); const { html, query } = require('./_util');
module.exports = async (req, res) => {
  const p = E.verify(query(req).get('token') || '', process.env.EMAIL_TOKEN_SECRET, 'c');
  if (!p) return html(res, 400, E.page('That link didn’t work', '<p>This confirmation link is invalid or has expired (links last 72 hours). Sign up again from NH Cart and use the newest email.</p>', false));
  const miss = E.missingEnv(['audience']); if (miss.length) return html(res, 503, E.page('Not switched on yet', '<p>Email signup isn’t configured yet, so nothing was saved. Please try again later.</p>', false));
  try { await E.upsertContact(p.e, false); } catch (e) { console.error(e.message); return html(res, 502, E.page('Something went wrong', '<p>We couldn’t confirm you just now. Please try the link again in a minute.</p>', false)); }
  return html(res, 200, E.page('You’re subscribed', `<p><b>${E.esc(p.e)}</b> will get the NH Cart weekly email: the best flyer deals and the cheapest meals, twice a week at most.</p><p>Every email has a one-click unsubscribe link.</p>`));
};
