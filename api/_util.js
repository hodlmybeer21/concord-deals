const readBody = req => new Promise(r => { if (req.body && typeof req.body === 'object') return r(req.body); let s = ''; req.on('data', c => { s += c; if (s.length > 1e4) req.destroy(); }); req.on('end', () => { try { r(s.startsWith('{') ? JSON.parse(s) : Object.fromEntries(new URLSearchParams(s))); } catch { r({}); } }); });
const json = (res, code, o) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.status(code).end(JSON.stringify(o)); };
const html = (res, code, s) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.status(code).end(s); };
const query = req => new URL(req.url, 'http://x').searchParams;
module.exports = { readBody, json, html, query };
