const test = require('node:test'), assert = require('node:assert');
const Cond = require('../conditions.js'), Meals = require('../meals.js'), DM = require('../match.js');
// Fixtures: Flipp item-detail fields as served 2026-10-14 (backflipp.wishabi.com/flipp/items/<id>)
const src = { source_url: 'https://flipp.com/en-us/flyer/1', fetched_at: '2026-10-14T11:15:44Z' };
const F = {
  butter: [{ ...src, item: 'Lucerne Butter', price: 2.49, price_text: '$2.49', unit: '16 oz pkg', store: "Shaw's", flipp_item_id: 1044810848 },
    { sale_story: '$10 off when you spend $25 on participating items.', description: '16 oz.', disclaimer_text: 'Limit 2\n\nLimit 1 per transaction*\n\n*Restrictions Apply. Digital coupon. Limit 1 per transaction. Visit shaws.com/stock-up.html for details.', dollars_off: 0.5 },
    { coupon: true, regular: 2.99, basis: 'flyer tile shows SALE PRICE 2.99, -.50 For U DIGITAL COUPON' }],
  coke: [{ ...src, item: 'Coca-Cola 8 Pack 12 oz. cans', price: 5.99, price_text: '$5.99', unit: 'per pack (when you buy 5+)', store: "Shaw's", flipp_item_id: 1044810743 },
    { price_text: 'WHEN YOU BUY 5 OR MORE PARTICIPATING ITEMS', description: 'Single Item Price $6.99', disclaimer_text: '+ deposit where applicable' }],
  berries: [{ ...src, item: 'Strawberries 1 lb. Blueberries Pint', price: 15, price_text: '$15.00', unit: '3/$15.00', store: "Shaw's", flipp_item_id: 1044811578 },
    { pre_price_text: '3/', price_text: 'WHEN YOU BUY 3', description: '6 oz.' }],
  plugra: [{ ...src, item: 'Plugra European Style Butter Sticks', price: 5, price_text: '$5.00', unit: '2/$5.00', store: 'Market Basket', flipp_item_id: 1047071943 },
    { pre_price_text: '2 for', sale_story: 'Save 98¢', description: '2 Varieties\nSave 98¢\n8 oz. PKG.', dollars_off: 0.98 }],
  oil: [{ ...src, item: 'Filippo Berio Olive Oil', price: 9.99, price_text: '$9.99', unit: '50.7 oz pkg', store: "Shaw's", flipp_item_id: 1044810086 },
    { original_price: '12.99', description: '50.7 oz., select varieties', disclaimer_text: 'Limit 2', dollars_off: 3 }],
  broth: [{ ...src, item: 'Swanson Broth', price: 1.79, price_text: '$1.79', unit: '32 oz pkg', store: "Shaw's", flipp_item_id: 1 },
    { sale_story: '$10 off when you spend $25 on participating items.', description: '32 oz., select varieties', disclaimer_text: 'Limit 2\n\nLimit 1 per transaction*\n\n*Restrictions Apply. Digital coupon. Limit 1 per transaction. Visit shaws.com/stock-up.html for details.' }],
};
const mk = k => { const [d, i, o] = F[k]; const x = { ...d }; const c = Cond.detect(x, i, o); if (c) x.cond = c; return x; };
const L = x => x.cond.labels.map(l => l.text);

test('Lucerne butter: For U coupon, regular $2.99 from hand-checked override', () => {
  const d = mk('butter'); assert.ok(d.cond.conditional); assert.strictEqual(d.cond.regular, 2.99);
  assert.deepStrictEqual(L(d), ['Spend $25 save $10', 'Digital coupon / For U', 'Limit 2']);
  const reg = Cond.view([d], false).deals[0]; assert.strictEqual(reg.price, 2.99); assert.strictEqual(reg.price_text, '$2.99');
  assert.strictEqual(Cond.view([d], true).deals[0].price, 2.49);
});
test('Lucerne butter without the override: coupon not claimed from stock-up text alone', () => {
  const [d, i] = F.butter; const c = Cond.detect({ ...d }, i, null);
  assert.ok(!c.conditional); assert.ok(!L({ cond: c }).includes('Digital coupon / For U'));
});
test('Coke 8pk: must buy 5+, single-item $6.99 is the default price', () => {
  const d = mk('coke'); assert.ok(d.cond.must); assert.strictEqual(d.cond.regular, 6.99);
  assert.deepStrictEqual(L(d), ['Must buy 5+ participating items']);
  const reg = Cond.view([d], false).deals[0]; assert.strictEqual(reg.price, 6.99); assert.strictEqual(reg.unit, 'per pack');
});
test('Strawberries 3/$15 when you buy 3: $5 each only with the bundle, no regular price listed', () => {
  const d = mk('berries'); assert.strictEqual(d.cond.each, 5); assert.strictEqual(d.cond.regular, null);
  assert.strictEqual(d.cond.basis, 'conditional price, regular price not listed'); assert.deepStrictEqual(L(d), ['3 for $15.00 · must buy 3']);
  const v = Cond.view([d], false); assert.strictEqual(v.deals.length, 0); assert.strictEqual(v.hidden.length, 1);
  const inc = Cond.view([d], true).deals[0]; assert.strictEqual(inc.price, 5); assert.strictEqual(inc.price_text, '$5.00 ea'); assert.strictEqual(inc.unit_min, 3);
});
test('Plugra 2/$5: per-item $2.50 plus "2 for $5.00"; meals counts whole bundles', () => {
  const d = mk('plugra'); assert.strictEqual(d.cond.each, 2.5); assert.deepStrictEqual(L(d), ['2 for $5.00']);
  const inc = Cond.view([d], true).deals[0]; assert.strictEqual(inc.price, 2.5);
  assert.strictEqual(Meals.costFor({ qty: 1, unit: 'each' }, inc).cost, 5);
  assert.strictEqual(Meals.costFor({ qty: 3, unit: 'each' }, inc).cost, 10);
  assert.strictEqual(Cond.view([d], false).deals.length, 0);
});
test('Filippo Berio olive oil (Shaw\'s): image-only coupon found from original_price hint, regular $12.99', () => {
  const d = mk('oil'); assert.ok(d.cond.conditional); assert.strictEqual(d.cond.regular, 12.99);
  assert.deepStrictEqual(L(d), ['Digital coupon / For U', 'Limit 2']); assert.strictEqual(Cond.view([d], false).deals[0].price, 12.99);
});
test('Spend $25 save $10 is a chip only; price not conditional', () => {
  const d = mk('broth'); assert.ok(!d.cond.conditional); assert.deepStrictEqual(L(d), ['Spend $25 save $10', 'Limit 2']);
  assert.strictEqual(Cond.view([d], false).deals[0].price, 1.79);
});
test('Sam\'s membership, Walmart was-price (no rollback claim), rebate, instant coupon', () => {
  assert.deepStrictEqual(L({ cond: Cond.detect({ store: "Sam's Club", price: 9 }, {}) }), ['Membership required']);
  const w = Cond.detect({ store: 'Walmart', price: 17.94 }, { original_price: '19.94', dollars_off: 2 }); assert.deepStrictEqual(L({ cond: w }), ['Was $19.94']); assert.ok(!w.conditional);
  assert.ok(L({ cond: Cond.detect({ store: "Shaw's", price: 9 }, { disclaimer_text: 'Mail-in rebate available' }) }).includes('Rebate, not subtracted'));
  assert.ok(L({ cond: Cond.detect({ store: 'Market Basket', price: 9 }, { sale_story: 'Instant Coupon' }) }).includes('Instant coupon at register'));
  assert.strictEqual(Cond.detect({ store: 'Aldi', price: 2 }, { description: '16 oz.' }), null);
});
test('ranking: default cheapest butter is not the coupon price; toggle includes it', () => {
  const other = { ...src, item: 'Butter', price: 2.79, price_text: '$2.79', unit: '16 oz pkg', store: 'Hannaford', flipp_item_id: 9 };
  const deals = [mk('butter'), other];
  assert.strictEqual(DM.match('butter', Cond.view(deals, false).deals).best.store, 'Hannaford');
  assert.strictEqual(DM.match('butter', Cond.view(deals, true).deals).best.store, "Shaw's");
});
test('never invents: regular not above the deal price is dropped', () => {
  const c = Cond.detect({ store: "Shaw's", price: 5 }, { price_text: 'WHEN YOU BUY 5', description: 'Single Item Price $4.00' });
  assert.strictEqual(c.regular, null); assert.strictEqual(c.basis, 'conditional price, regular price not listed');
});
