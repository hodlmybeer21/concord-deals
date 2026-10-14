const test = require('node:test'), assert = require('node:assert');
const Cond = require('../conditions.js'), { fetchDetails } = require('../lib/flipp.js');
const L = c => c ? c.labels.map(l => l.text) : [];
test('member / card price is conditional; regular only from original_price', () => {
  const c = Cond.detect({ store: 'Hannaford', price: 3 }, { sale_story: 'My Hannaford Rewards members save' });
  assert.ok(c.conditional); assert.deepStrictEqual(L(c), ['Member / card price']); assert.strictEqual(c.regular, null);
  const c2 = Cond.detect({ store: 'Hannaford', price: 3 }, { disclaimer_text: 'with card', original_price: '3.99' }); assert.strictEqual(c2.regular, 3.99);
});
test('Sam\'s Instant Savings, Walmart rollback/clearance only when stated, points, participating, select stores', () => {
  assert.deepStrictEqual(L(Cond.detect({ store: "Sam's Club", price: 9 }, { sale_story: 'Instant Savings' })), ['Instant Savings (no clip)', 'Membership required']);
  assert.ok(L(Cond.detect({ store: 'Walmart', price: 9 }, { sale_story: 'Rollback' })).includes('Rollback (as stated)'));
  assert.ok(!L(Cond.detect({ store: 'Walmart', price: 9 }, { original_price: '12' })).some(t => /Rollback/.test(t)));
  assert.ok(L(Cond.detect({ store: "Shaw's", price: 9 }, { sale_story: 'Earn 2X points' })).includes('Bonus points, not subtracted'));
  assert.ok(L(Cond.detect({ store: "Shaw's", price: 9 }, { disclaimer_text: 'Restrictions apply.' })).includes('Participating items only'));
  assert.ok(L(Cond.detect({ store: 'Market Basket', price: 9 }, { disclaimer_text: 'Not available in NH stores' })).includes('Select stores only'));
});
test('Hannaford "SAVE $3.98 ON 2" multi-buy keeps per-item price, no invented regular', () => {
  const c = Cond.detect({ store: 'Hannaford', price: 10, unit: '2/$10.00' }, { pre_price_text: '2/', sale_story: 'SAVE $3.98 ON 2' });
  assert.strictEqual(c.each, 5); assert.strictEqual(c.regular, null);
});
test('fetchDetails keeps only label fields, counts failures, dedupes ids', async () => {
  const calls = []; const get = async u => { calls.push(u); if (u.includes('/3?')) throw new Error('x'); return { item: { name: 'n', sale_story: 'Save 50¢', description: '', dollars_off: 0.5, cutout_image_url: 'x' } }; };
  const r = await fetchDetails([{ flipp_item_id: 1 }, { flipp_item_id: 1 }, { flipp_item_id: 2 }, { flipp_item_id: 3 }], { get, concurrency: 2 });
  assert.strictEqual(calls.length, 3); assert.strictEqual(r.ok, 2); assert.strictEqual(r.failed, 1);
  assert.deepStrictEqual(r.items[1], { sale_story: 'Save 50¢', dollars_off: 0.5 }); assert.ok(r.fetched_at);
});
test('Shaw\'s badge read adds the coupon; pre-coupon price from dollars_off only when coupon confirmed', () => {
  const info = { sale_story: '$10 off when you spend $25 on participating items.', disclaimer_text: 'Limit 2 *Restrictions Apply. Digital coupon. Visit shaws.com/stock-up.html', dollars_off: 1.2 };
  assert.ok(!Cond.detect({ store: "Shaw's", price: 1.79 }, info).conditional);
  const c = Cond.detect({ store: "Shaw's", price: 1.79 }, info, { coupon: true, basis: 'OCR read' });
  assert.ok(c.conditional); assert.strictEqual(c.regular, 2.99); assert.ok(L(c).includes('Digital coupon / For U'));
  const g = Cond.detect({ store: "Shaw's", price: 1.79 }, { disclaimer_text: 'Limit 2 Bags' }, { coupon: true });
  assert.strictEqual(g.regular, null); assert.strictEqual(g.basis, 'conditional price, regular price not listed');
});
test('badge_reads.json and overrides are well-formed', () => {
  const b = require('../data/badge_reads.json'), o = require('../data/condition_overrides.json');
  for (const [k, v] of Object.entries(b.items)) { assert.match(k, /^\d+$/); assert.strictEqual(v.coupon, true); assert.match(v.image, /^https:\/\/f\.wishabi\.net\//); }
  for (const [k, v] of Object.entries(o)) if (k !== '_note') { assert.ok(v.basis && v.image); if (v.regular) assert.ok(v.regular > 0); }
});
