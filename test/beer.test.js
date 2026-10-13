const test = require('node:test'), assert = require('node:assert');
const A = require('../alcohol.js'), M = require('../match.js'), Meals = require('../meals.js'), { enrichAlcohol } = require('../lib/flipp');
const deal = (item, price, extra = {}) => ({ item, price, price_text: `$${price.toFixed(2)}`, store: extra.store || 'Hannaford', flipp_item_id: extra.id || Math.floor(Math.random() * 1e9), valid_to: '2099-01-01', unit: extra.unit || null, ...extra });

test('classify: sub-tags', () => {
  for (const [n, sub] of [['12-Pack Samuel Adams', 'Beer'], ['• Miller Lite • Coors Light', 'Beer'], ['9-Pack Downeast Cider', 'Cider'], ['White Claw Hard Seltzer', 'Hard seltzer & RTD'],
    ["Mike's Hard Lemonade, Athletic Brewing, White Claw Hard Seltzers", 'Hard seltzer & RTD'], ['Kendall Jackson Wine', 'Wine'], ['Barefoot Rosé', 'Wine'], ['Bota Box Wines', 'Boxed wine']])
    assert.equal(A.classify(n)?.sub, sub, n); });
test('classify: exclusions are not alcohol', () => {
  for (const n of ['Filippo Berio Red Wine Vinegar', 'Holland House Cooking Wine', 'A&W Root Beer', 'Reed\'s Ginger Beer', 'Canada Dry Ginger Ale', "Member's Mark Stemless Wine Glasses", 'Our Famous Apple Cider Doughnuts',
    "Zeigler's Apple Cider", 'Adult Alka-Seltzer Plus', 'MARKET BASKET Cranberry Cocktail', 'Red Rose Tea Bags', "Stella D'oro Cookies", 'White Wine Pepper Sauce Chicken', 'Beer Battered Fish'])
    assert.equal(A.classify(n), null, n); });
test('classify: non-alcoholic marked NA (all vs some)', () => {
  assert.equal(A.classify('Athletic Brewing Run Wild IPA Non-Alcoholic')?.na, 'all'); assert.equal(A.classify("Mike's Hard Lemonade, Athletic Brewing, White Claw")?.na, 'some'); });
test('pack sizes from Flipp item details; per-unit only when count AND size are stated', () => {
  const sa = A.describe(deal('12-Pack Samuel Adams', 15.99), { description: '12 Oz. Bottles or Cans\nSelect Varieties', disclaimer_text: 'Plus Deposit Where Applicable' });
  assert.equal(sa.unit, '12 × 12 oz bottles or cans'); assert.equal(sa.per.v.toFixed(2), '1.33'); assert.equal(sa.flag, null);
  const dc = A.describe(deal('Downeast Cider', 16.99), { description: '12 oz., 9 pack' }); assert.equal(dc.unit, '9 × 12 oz'); assert.equal(dc.per.u, 'each');
  const ml = A.describe(deal('• Miller Lite • Coors Light', 14.99), { description: '15 PACK ALUMINUM' }); assert.equal(ml.unit, null); assert.equal(ml.per, null); assert.match(ml.flag, /pack size unconfirmed: flyer gives 15-pack, no container size/);
  const mu = A.describe(deal('Michelob Ultra', 19.99, { unit: '24 pack' }), { description: '• Bottles • Cans' }); assert.equal(mu.count, 24); assert.equal(mu.per, null); assert.match(mu.flag, /24-pack/);
  const kj = A.describe(deal('Kendall Jackson Wine', 13.99), { description: '750 mL\nSelect Varieties' }); assert.equal(kj.unit, '750 ml bottle'); assert.equal(kj.per, null);
  const bb = A.describe(deal('Bota Box Wines', 17.99), { description: '3 LTR.' }); assert.equal(bb.unit, '3 L box'); assert.equal(bb.per.u, '750 ml'); assert.equal(bb.per.v.toFixed(2), '4.50');
  const none = A.describe(deal('Corona Extra', 15.99), null); assert.match(none.flag, /no pack count or size/); });
test('labels: flyer wording copied verbatim; our notes kept separate', () => {
  const r = A.describe(deal('Michelob Ultra 24 Pack', 16.99), { description: '12 oz.', sale_story: '$5 DIGITAL REBATE via PayPal', disclaimer_text: 'Limit 1\nRebate must be downloaded to your For U account prior to purchase.' });
  const fl = r.labels.filter(l => l.src === 'flyer').map(l => l.t), nc = r.labels.filter(l => l.src === 'nhcart').map(l => l.t);
  assert.deepEqual(fl, ['$5 DIGITAL REBATE via PayPal', 'Limit 1', 'Rebate must be downloaded to your For U account prior to purchase.']); assert.ok(nc.includes('Rebate not subtracted from the price shown'));
  const sh = A.describe(deal('Sutter Home Wines', 8.99), { description: '1.5 LTR.', sale_story: 'Sale Price Instant Coupon Final Cost' }); assert.ok(sh.labels.some(l => /final cost after the instant coupon/.test(l.t)));
  const mb = A.describe(deal('SAM ADAMS "BLUE MOON" HEINEKEN', 14.99), { sale_story: 'Not Applicable In Maine, MA & RI' }); assert.ok(mb.labels.some(l => l.src === 'flyer' && l.t === 'Not Applicable In Maine, MA & RI'));
  const dep = A.describe(deal('Apothic Wine', 8.99), { description: '750 mL', disclaimer_text: 'Plus Deposit Where Applicable' }); assert.ok(dep.labels.some(l => l.t === 'Plus Deposit Where Applicable'));
  const mm = A.describe(deal('Craft Beer Mix & Match 6 Pack', 9.99), { description: '12 oz.' }); assert.ok(mm.labels.some(l => l.t === 'Mix & match' && l.src === 'flyer')); });
test('search: beer/wine/cider/brands find alcohol; vinegar, apple cider and lemonade stay groceries', () => {
  const D = [deal('12-Pack Samuel Adams', 15.99), deal('Kendall Jackson Wine', 13.99), deal('Downeast Cider', 16.99), deal("Mike's Hard Lemonade, White Claw Hard Seltzers", 15.99, { store: "Shaw's" }),
    deal('Red Wine Vinegar', 2.99, { store: 'MB' }), deal("Zeigler's Apple Cider", 3.99, { store: 'MB' }), deal('Apple Cider Doughnuts', 3.96, { store: 'X' }), deal('Simply Lemonade', 2.5, { store: 'Y' }), deal('A&W Root Beer', 4, { store: 'Z' })];
  const names = q => Object.values(M.match(q, D.map(d => ({ ...d }))).byStore).map(d => d.item).sort();
  assert.deepEqual(names('beer'), ['12-Pack Samuel Adams']); assert.deepEqual(names('wine'), ['Kendall Jackson Wine']); assert.deepEqual(names('cider'), ['Downeast Cider']);
  assert.deepEqual(names('hard seltzer'), ["Mike's Hard Lemonade, White Claw Hard Seltzers"]); assert.deepEqual(names('white claw'), ["Mike's Hard Lemonade, White Claw Hard Seltzers"]); assert.deepEqual(names('sam adams'), ['12-Pack Samuel Adams']);
  assert.deepEqual(names('lemonade'), ['Simply Lemonade']); assert.deepEqual(names('apple cider'), ['Apple Cider Doughnuts', "Zeigler's Apple Cider"]); assert.deepEqual(names('root beer'), ['A&W Root Beer']); assert.deepEqual(names('wine vinegar'), ['Red Wine Vinegar']); });
test('meals never use alcohol deals', () => {
  const r = { name: 'Test', serves: 4, tags: [], ingredients: [{ name: 'beer', qty: 12, unit: 'oz', pantry: false }], steps: [] };
  const m = Meals.priceAll([r], [deal('12-Pack Samuel Adams', 15.99, { unit: '12 × 12 oz bottles or cans' })], { estimates: {} }, { Hannaford: { status: 'ok' } })[0]; assert.equal(m.nDeal, 0); });
test('refresh: enrichAlcohol fetches Flipp item details and fixes the "12 oz pkg" unit', async () => {
  const real = global.fetch; const urls = [];
  global.fetch = async u => { urls.push(String(u)); return { ok: true, json: async () => ({ item: { description: '12 oz., 12 pack', sale_story: null, disclaimer_text: null } }) }; };
  try { const d = [deal('Corona, Modelo Samuel Adams or Blue Moon', 15.99, { id: 1044810477, unit: '12 oz pkg', store: "Shaw's" }), deal('Bananas', 0.59, { id: 5, unit: 'lb' })];
    await enrichAlcohol(d); assert.equal(urls.length, 1); assert.match(urls[0], /^https:\/\/backflipp\.wishabi\.com\/flipp\/items\/1044810477/);
    assert.equal(d[0].unit, '12 × 12 oz'); assert.match(d[0].unit_source, /flipp\/items\/1044810477/); assert.equal(d[0].price, 15.99); assert.equal(d[1].unit, 'lb'); assert.equal(d[1].alc, undefined);
    assert.ok(urls.every(u => !/walmart\.com|samsclub\.com/.test(u))); } finally { global.fetch = real; } });
