// GET shows a confirm button and changes nothing (link scanners/prefetchers can't unsubscribe anyone).
// POST unsubscribes: the confirm button (confirm=1 -> HTML page) and RFC 8058 one-click (List-Unsubscribe=One-Click -> JSON). Token never expires.
const E = require('../lib/email'); const { html, json, query, readBody } = require('./_util');
module.exports = async (req, res) => {
  const token = query(req).get('token') || '', p = E.verify(token, process.env.EMAIL_TOKEN_SECRET, 'u');
  const post = req.method === 'POST', b = post ? await readBody(req) : {}, page = post && String(b.confirm) === '1';
  const fail = (code, title, msg) => post && !page ? json(res, code, { ok: false }) : html(res, code, E.page(title, msg, false));
  if (!p) return fail(400, 'That link didn’t work', '<p>This unsubscribe link is invalid. Reply to any NH Cart email and we’ll remove you by hand.</p>');
  if (!post) return html(res, 200, E.page('Unsubscribe from NH Cart?', `<p><b>${E.esc(p.e)}</b> will stop getting the NH Cart weekly email.</p>
<form method="post" action="/api/unsubscribe?token=${E.esc(encodeURIComponent(token))}"><input type="hidden" name="confirm" value="1">
<button type="submit" style="width:100%;min-height:52px;border:0;border-radius:14px;background:#b42318;color:#fff;font:700 16px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;cursor:pointer">Unsubscribe</button></form>`, false));
  if (E.missingEnv(['audience']).length) return fail(503, 'Try again shortly', '<p>We couldn’t reach our mailing list just now. Please try again later.</p>');
  try { await E.setUnsubscribed(p.e); } catch (e) { console.error(e.message); if (e.status !== 404) return fail(502, 'Something went wrong', '<p>Please try again in a minute.</p>'); }
  if (!page) return json(res, 200, { ok: true });
  return html(res, 200, E.page('You’re unsubscribed', `<p><b>${E.esc(p.e)}</b> won’t get any more NH Cart emails.</p><p>Changed your mind? You can sign up again on the site any time.</p>`));
};
