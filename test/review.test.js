const test = require('node:test'), assert = require('node:assert'), fs = require('fs'), os = require('os'), path = require('path');
const { flyerUrl, httpsImg } = require('../lib/flipp'); const { writeHistory, historyRows } = require('../lib/history');
const DATA = require('../data/deals.json'); const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
global.DealMatch = require('../match.js');
// pull pure helpers out of index.html so the UI logic is tested as shipped
const grab = re => { const m = SRC.match(re); assert.ok(m, 'missing ' + re); return m[0]; };
const FixedDate = class extends Date { constructor(...a) { super(...(a.length ? a : [DATA.fetched_at])); } }; // freeze 'now' at the snapshot time
require('../alcohol.js');
const ctx = new Function('DATA', 'Date', 'window', `const isAlcD=d=>!!(d.alc||(window.Alcohol&&Alcohol.classify(d.item)));${grab(/const CATS=[\s\S]*?\nconst uFam/).replace(/\nconst uFam$/, '')};
  let BEST=null;const STAPLES=${SRC.match(/const STAPLES=(\[[^\]]*\])/)[1]};const BX=${SRC.match(/const BX=(\{[^;]*);/)[1]};
  ${grab(/function bestDeals\(\)[\s\S]*?return BEST\}/)}; ${grab(/function cleanLines[\s\S]*?return out\.slice\(0,60\)\}/)};
  return {bestDeals,cleanLines,cat};`)(DATA, FixedDate, globalThis);

test('flyer deep link uses the en-us viewer path with the postal code', () => assert.equal(flyerUrl(8185495), 'https://flipp.com/en-us/flyer/8185495?postal_code=03301'));
test('thumbnails: only Flipp CDN images, forced to https', () => {
  assert.equal(httpsImg('http://f.wishabi.net/page_items/1/2/extra_large.jpg'), 'https://f.wishabi.net/page_items/1/2/extra_large.jpg');
  assert.equal(httpsImg('https://evil.example/x.jpg'), null); assert.equal(httpsImg(null), null); });
test('history rows copy flyer prices verbatim with source_url and fetched_at', () => {
  const rows = historyRows(DATA); assert.equal(rows.length, DATA.deals.length);
  rows.forEach((r, i) => { const d = DATA.deals[i]; assert.equal(r.price, d.price); assert.equal(r.price_text, d.price_text); assert.ok(r.source_url); assert.ok(r.fetched_at); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'h')); const f = writeHistory(DATA, dir); assert.match(path.basename(f), /^\d{4}-\d{2}-\d{2}\.json$/);
  const j = JSON.parse(fs.readFileSync(f)); assert.equal(j.fetched_at, DATA.fetched_at); assert.equal(j.rows.length, DATA.deals.length); });
test('best this week: every entry is a real confirmed-unit flyer deal, ranked by store coverage', () => {
  const B = ctx.bestDeals(); assert.ok(B.length > 10);
  for (const b of B) { assert.ok(DATA.deals.includes(b.d), 'must be an actual deal object'); assert.equal(globalThis.Alcohol.classify(b.d.item), null, 'no alcohol in best-this-week'); assert.ok(b.d.unit && !b.d.flag); assert.ok(b.d.source_url); assert.ok(b.d.fetched_at || DATA.fetched_at); }
  for (let i = 1; i < B.length; i++) assert.ok(B[i - 1].n >= B[i].n);
  const butter = B.find(b => b.q === 'butter'); assert.ok(!butter || /\bbutter\b/i.test(butter.d.item) && !/butternut|shea|peanut/i.test(butter.d.item)); });
test('receipt/paste: keeps item names, drops prices, totals, payment and store lines', () => {
  const out = ctx.cleanLines('MARKET BASKET #12\nBANANAS 1.29 lb @ 0.59\nGRND BEEF 85% 6.49\nEGGS LG DOZ 3.99\nSUBTOTAL 12.99\nTAX 0.00\nVISA 12.99\nmilk, coffee');
  assert.deepEqual(out, ['bananas', 'ground beef', 'eggs', 'milk', 'coffee']); assert.ok(out.every(x => !/\d/.test(x))); });
test('index.html: wrong-price mailto, signup is inert until the backend says open, no savings math', () => {
  assert.match(SRC, /nhcart@mail\.grokbot\.com/); assert.match(SRC, /SIGNUP=!!\(j&&j\.open===true\)/); assert.match(SRC, /disabled aria-disabled="true"/);
  assert.ok(!/regular_price|you save \$|\bsave \$\{/i.test(SRC)); });
test('share codec round-trips unicode list text', () => {
  const e = new Function(`return ${SRC.match(/const b64e=(o=>[^;]*);/)[1]}`)(), d = new Function(`return ${SRC.match(/const b64d=(t=>[\s\S]*?charCodeAt\(0\)\)\)\));/)[1]}`)();
  const o = { v: 1, l: ['crème fraîche', 'eggs'], p: [] }; assert.deepEqual(d(e(o)), o); });
