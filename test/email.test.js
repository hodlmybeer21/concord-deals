const test = require('node:test'), assert = require('node:assert');
const E = require('../lib/email');
const calls = []; global.fetch = async (u) => { calls.push(String(u)); throw new Error('network disabled in tests'); };
const mockRes = () => { const r = { code: 0, body: '', h: {}, setHeader(k, v) { r.h[k] = v; }, status(c) { r.code = c; return r; }, end(s) { r.body = s; } }; return r; };
const S = 'test-secret';
test('sign/verify round trip', () => { const t = E.confirmToken('A@B.co', S); const p = E.verify(t, S, 'c'); assert.equal(p.e, 'a@b.co'); });
test('tampered token rejected', () => { const t = E.unsubToken('a@b.co', S); const [b, s] = t.split('.'); const fake = Buffer.from(JSON.stringify({ p: 'u', e: 'evil@x.co' })).toString('base64url'); assert.equal(E.verify(fake + '.' + s, S, 'u'), null); assert.equal(E.verify(b + '.' + s.slice(0, -2) + 'AA', S, 'u'), null); });
test('wrong secret / wrong purpose / expired rejected', () => { const t = E.confirmToken('a@b.co', S); assert.equal(E.verify(t, 'other', 'c'), null); assert.equal(E.verify(t, S, 'u'), null); assert.equal(E.verify(t, S, 'c', Date.now() + 73 * 36e5), null); assert.equal(E.verify('garbage', S, 'c'), null); });
test('unsubscribe token never expires', () => { const t = E.unsubToken('a@b.co', S); assert.ok(E.verify(t, S, 'u', Date.now() + 10 * 365 * 864e5)); });
test('missingEnv lists every absent var', () => { assert.deepEqual(E.missingEnv(['send', 'audience', 'postal'], {}).sort(), ['EMAIL_TOKEN_SECRET', 'MAIL_FROM', 'MAIL_POSTAL_ADDRESS', 'RESEND_API_KEY', 'RESEND_AUDIENCE_ID']); });
test('subscribe fails safe with no env: 503, nothing sent', async () => { for (const k of ['RESEND_API_KEY','RESEND_AUDIENCE_ID','MAIL_FROM','MAIL_POSTAL_ADDRESS','EMAIL_TOKEN_SECRET','CRON_SECRET']) delete process.env[k];
  const r = mockRes(); calls.length = 0; await require('../api/subscribe')({ method: 'POST', headers: {}, body: { email: 'x@y.co' } }, r);
  assert.equal(r.code, 503); assert.ok(JSON.parse(r.body).missing.includes('RESEND_API_KEY')); assert.equal(calls.filter(u => u.includes('resend')).length, 0); });
test('subscribe honeypot pretends success, sends nothing', async () => { const r = mockRes(); calls.length = 0; await require('../api/subscribe')({ method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: { email: 'x@y.co', website: 'spam' } }, r); assert.equal(r.code, 200); assert.equal(calls.length, 0); });
test('digest refuses without CRON_SECRET', async () => { const r = mockRes(); await require('../api/digest')({ url: '/api/digest', headers: {} }, r); assert.equal(r.code, 503); });
test('digest with cron secret but no mail env: renders dry-run, refuses real send', async () => { process.env.CRON_SECRET = 'c';
  const r = mockRes(); calls.length = 0; await require('../api/digest')({ url: '/api/digest', headers: { authorization: 'Bearer c' } }, r);
  assert.equal(r.code, 503); assert.equal(JSON.parse(r.body).sent, 0); assert.equal(calls.filter(u => u.includes('resend')).length, 0);
  const d = mockRes(); await require('../api/digest')({ url: '/api/digest?dry=1', headers: { authorization: 'Bearer c' } }, d); assert.equal(d.code, 200); assert.match(d.body, /\[mailing address goes here\]/); assert.match(d.body, /Unsubscribe/);
  const bad = mockRes(); await require('../api/digest')({ url: '/api/digest?dry=1', headers: { authorization: 'Bearer nope' } }, bad); assert.equal(bad.code, 401); });
test('unsubscribe with bad token shows friendly error', async () => { process.env.EMAIL_TOKEN_SECRET = S; const r = mockRes(); await require('../api/unsubscribe')({ method: 'GET', url: '/api/unsubscribe?token=bad' }, r); assert.equal(r.code, 400); assert.match(r.body, /didn’t work/); });

const FULL = { RESEND_API_KEY: 'k', RESEND_AUDIENCE_ID: 'a', MAIL_FROM: 'deals@nhcart.goodbotai.tech', EMAIL_TOKEN_SECRET: S, CRON_SECRET: 'c' };
function withResendStub(fn) { return async () => { const sent = []; const orig = global.fetch; global.fetch = async (u, o) => { u = String(u); calls.push(u);
  if (u.includes('api.resend.com')) { sent.push({ u, body: o.body && JSON.parse(o.body) }); return { ok: true, status: 200, text: async () => JSON.stringify(u.includes('/contacts') ? { data: [{ email: 'sub@x.co', unsubscribed: false }] } : { id: 'msg_test' }) }; }
  throw new Error('net off'); }; try { await fn(sent); } finally { global.fetch = orig; } }; }
test('no postal address: subscriber broadcast blocked with 503, nothing sent', withResendStub(async sent => { Object.assign(process.env, FULL); delete process.env.MAIL_POSTAL_ADDRESS;
  const r = mockRes(); await require('../api/digest')({ url: '/api/digest', headers: { authorization: 'Bearer c' } }, r);
  assert.equal(r.code, 503); assert.equal(JSON.parse(r.body).error, 'postal address required'); assert.equal(sent.length, 0); }));
test('no postal address: signup blocked ("opening soon"), nothing sent', withResendStub(async sent => { const r = mockRes(); await require('../api/subscribe')({ method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body: { email: 'new@x.co' } }, r);
  assert.equal(r.code, 503); assert.match(JSON.parse(r.body).error, /opening soon/); assert.equal(sent.length, 0); }));
test('test path sends exactly one email to the hardcoded test address, address placeholder marked, reply-to set', withResendStub(async sent => { const r = mockRes(); await require('../api/digest')({ url: '/api/digest?test=1', headers: { authorization: 'Bearer c' } }, r);
  const j = JSON.parse(r.body); assert.equal(r.code, 200); assert.equal(j.sent, 1); assert.equal(sent.length, 1);
  const b = sent[0].body; assert.deepEqual(b.to, ['hodlmybeer21@gmail.com']); assert.equal(b.reply_to, 'nhcart@mail.grokbot.com'); assert.match(b.subject, /^\[TEST\]/);
  assert.doesNotMatch(b.html, /MAIL_POSTAL_ADDRESS/); assert.match(b.html, /\[mailing address goes here\]/); assert.match(b.text, /\[mailing address goes here\]/); assert.match(b.html, /nhcart@mail\.grokbot\.com/); assert.ok(b.headers['List-Unsubscribe']); }));
test('test path needs the cron secret', withResendStub(async sent => { const r = mockRes(); await require('../api/digest')({ url: '/api/digest?test=1', headers: {} }, r); assert.equal(r.code, 401); assert.equal(sent.length, 0); }));
test('with postal address set, broadcast goes to subscribers with reply-to + unsubscribe headers', withResendStub(async sent => { process.env.MAIL_POSTAL_ADDRESS = 'PO Box 1, Concord NH 03301';
  const r = mockRes(); await require('../api/digest')({ url: '/api/digest', headers: { authorization: 'Bearer c' } }, r); delete process.env.MAIL_POSTAL_ADDRESS;
  assert.equal(r.code, 200); const batch = sent.find(x => x.u.endsWith('/emails/batch')).body; assert.deepEqual(batch[0].to, ['sub@x.co']); assert.equal(batch[0].reply_to, 'nhcart@mail.grokbot.com'); assert.match(batch[0].html, /PO Box 1/); }));

// ---- status endpoint, click-to-unsubscribe ----
test('status: open only when MAIL_POSTAL_ADDRESS and send/audience env are set', withResendStub(async sent => { Object.assign(process.env, FULL); delete process.env.MAIL_POSTAL_ADDRESS;
  const st = async () => { const r = mockRes(); await require('../api/subscribe')({ method: 'GET', url: '/api/subscribe?status=1', headers: {} }, r); assert.equal(r.code, 200); return JSON.parse(r.body).open; };
  assert.equal(await st(), false); process.env.MAIL_POSTAL_ADDRESS = 'PO Box 1, Concord NH 03301'; assert.equal(await st(), true);
  delete process.env.RESEND_AUDIENCE_ID; assert.equal(await st(), false); Object.assign(process.env, FULL); delete process.env.MAIL_POSTAL_ADDRESS; assert.equal(sent.length, 0); }));
test('subscribe POST errors carry a human message in `error`', withResendStub(async () => { const r = mockRes(); await require('../api/subscribe')({ method: 'POST', headers: { 'x-forwarded-for': '7.7.7.7' }, body: { email: 'nope' } }, r);
  assert.equal(r.code, 400); assert.match(JSON.parse(r.body).error, /valid email/); }));
const UNS = (method, token, body) => { const r = mockRes(); return require('../api/unsubscribe')({ method, url: '/api/unsubscribe?token=' + encodeURIComponent(token), headers: {}, body }, r).then(() => r); };
test('unsubscribe GET only shows a confirm button and changes nothing', withResendStub(async sent => { Object.assign(process.env, FULL); const r = await UNS('GET', E.unsubToken('sub@x.co', S));
  assert.equal(r.code, 200); assert.match(r.body, /<form method="post"/); assert.match(r.body, /name="confirm" value="1"/); assert.match(r.body, />Unsubscribe<\/button>/); assert.equal(sent.length, 0); }));
test('unsubscribe confirm button POST unsubscribes and shows a page', withResendStub(async sent => { const r = await UNS('POST', E.unsubToken('sub@x.co', S), { confirm: '1' });
  assert.equal(r.code, 200); assert.match(r.body, /unsubscribed/); assert.equal(sent.length, 1); assert.match(sent[0].u, /contacts\/sub%40x\.co$/); assert.deepEqual(sent[0].body, { unsubscribed: true }); }));
test('RFC 8058 one-click POST unsubscribes (JSON)', withResendStub(async sent => { const r = await UNS('POST', E.unsubToken('sub@x.co', S), { 'List-Unsubscribe': 'One-Click' });
  assert.equal(r.code, 200); assert.deepEqual(JSON.parse(r.body), { ok: true }); assert.equal(sent.length, 1); }));
test('unsubscribe POST with a bad token is refused, nothing changed', withResendStub(async sent => { const r = await UNS('POST', 'bad', { 'List-Unsubscribe': 'One-Click' }); assert.equal(r.code, 400); assert.equal(sent.length, 0); }));
