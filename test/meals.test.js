const test = require('node:test'), assert = require('node:assert');
const M = require('../meals.js');
const R = { name: 'Test Tacos', serves: 4, tags: [], ingredients: [
  { name: 'ground beef', qty: 1, unit: 'lb', q: 'ground beef' },
  { name: 'avocados', qty: 2, unit: 'each', q: 'avocado' },
  { name: 'lettuce', qty: 1, unit: 'each', q: 'lettuce' },
  { name: 'limes', qty: 2, unit: 'each', q: 'lime' },
  { name: 'salt', pantry: true }] };
const deal = (item, price, unit, extra) => Object.assign({ item, price, unit, store: 'S', flipp_item_id: item }, extra);
const stores = { S: { status: 'ok' } };
test('meals: zero sale items are never listed (unknown prices are not $0 meals)', () => {
  const all = M.priceAll([R], [], null, stores);
  assert.equal(all[0].nDeal, 0); assert.equal(all[0].total, 0);
  assert.deepEqual(M.onSale(all), []);
});
test('meals: one sale item in a 4-item list is not enough', () => {
  const all = M.priceAll([R], [deal('Ground Beef', 4, 'lb')], null, stores);
  assert.equal(all[0].nDeal, 1); assert.deepEqual(M.onSale(all), []);
});
test('meals: flyer deals with no confirmed unit do not count as on sale', () => {
  const all = M.priceAll([R], [deal('Ground Beef', 4, null, { flag: 'unit not stated' }), deal('Hass Avocado', 1, null, { flag: 'unit not stated' })], null, stores);
  assert.deepEqual(M.onSale(all), []);
});
test('meals: 2 of 4 on sale (50%) is listed, and ranks below 3 of 4', () => {
  const R2 = Object.assign({}, R, { name: 'More On Sale' });
  const d = [deal('Ground Beef', 4, 'lb'), deal('Hass Avocado', 1, 'each')];
  const all = [M.price(R, d, null, stores), M.price(R2, d.concat(deal('Iceberg Lettuce', 2, 'each')), null, stores)];
  const shown = M.onSale(all);
  assert.deepEqual(shown.map(m => m.recipe.name), ['More On Sale', 'Test Tacos']);
  assert.ok(shown.every(m => m.total > 0 && m.mainOnSale));
});
