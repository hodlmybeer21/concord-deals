const test = require('node:test'), assert = require('node:assert'); const { match } = require('../match.js');
const D = items => items.map((item, i) => ({ item, price: 1 + i, store: 'S' + i, flipp_item_id: i }));
const hits = (q, items) => Object.values(match(q, D(items)).byStore).map(d => d.item);
const cases = {
  butter: [['Lucerne Butter', 'Cabot Butter Quarters', 'Plugra European Style Butter Sticks', 'Land O Lakes Salted Butter'],
           ['Jif Peanut Butter', 'Butternut Squash', 'Apple Butter', 'Buttermilk Biscuits', 'Shea Butter Leave-In Cream', 'Butter Cookies', 'Almond Butter']],
  milk: [['Stonyfield Organic Milk', 'Hood 2% Milk Gallon', 'Fairlife Ultra-Filtered Milk'], ['Hershey Milk Chocolate Bar', 'Buttermilk', 'Coconut Milk', 'Milk Bone Dog Treats']],
  chicken: [['Chicken Leg Quarters', 'Boneless Chicken Breast', 'Fresh Whole Chickens'], ['Swanson Chicken Broth', 'Chicken Noodle Soup', 'Chicken of the Sea Tuna', 'Tyson Chicken Nuggets', 'Chicken Stock']],
  corn: [['Green Giant Whole Kernel Sweet Corn', 'Fresh Corn on the Cob'], ['Orville Popcorn', 'Kellogg Corn Flakes', 'Corn Chips', 'Corn Chowder', 'Cornstarch', 'Corn Tortillas']],
  cream: [['Hood Heavy Cream', 'Light Cream Pint'], ['Hood Ice Cream', 'Philadelphia Cream Cheese', 'Daisy Sour Cream', 'Cream Soda', 'Orange Cream Bars']],
  eggs: [['Large Brown Eggs', 'Nellie\'s Free Range Eggs'], ['Egg Noodles', 'Chocolate Eggs', 'Egg Rolls']],
  apples: [['McIntosh Apples', 'Honeycrisp Apple'], ['Apple Juice', 'Apple AirPods 4', 'Mott\'s Apple Sauce']],
  coffee: [['La Colombe Coffee', 'Dunkin Ground Coffee'], ['Coffee mate Creamer', 'Mr. Coffee Coffee Maker', 'Coffee Table']],
  rice: [['Instant White Rice', 'Jasmine Rice'], ['Rice Krispies Cereal', 'Rice Cooker', 'Cauliflower Rice', 'Rice Cakes']],
  cheese: [['Shredded Cheddar Cheese', 'Bar Cheese'], ['Cream Cheese', 'Nacho Cheese Chips', 'Cheese Pizza', 'Mac & Cheese', 'Cheesecake']],
};
for (const [q, [yes, no]] of Object.entries(cases)) test(`matcher: "${q}" whole-word, no compound products`, () => {
  for (const y of yes) assert.deepEqual(hits(q, [y]), [y], `${q} should match ${y}`);
  for (const n of no) assert.deepEqual(hits(q, [n]), [], `${q} must not match ${n}`); });
test('matcher: compound queries still match their own product', () => {
  assert.deepEqual(hits('peanut butter', ['Jif Peanut Butter']), ['Jif Peanut Butter']); assert.deepEqual(hits('ice cream', ['Hood Ice Cream']), ['Hood Ice Cream']);
  assert.deepEqual(hits('cream cheese', ['Philadelphia Cream Cheese']), ['Philadelphia Cream Cheese']); assert.deepEqual(hits('chicken broth', ['Swanson Chicken Broth']), ['Swanson Chicken Broth']);
  assert.deepEqual(hits('apple juice', ['Mott\'s Apple Juice']), ['Mott\'s Apple Juice']); assert.deepEqual(hits('coffee maker', ['Mr. Coffee Coffee Maker']), ['Mr. Coffee Coffee Maker']); });
test('matcher: plurals and recall for normal queries', () => {
  assert.deepEqual(hits('potatoes', ['Maine White Potatoes']).length, 1); assert.deepEqual(hits('potato', ['Russet Potatoes']).length, 1);
  assert.deepEqual(hits('ground beef', ['Fresh 85% Lean Ground Beef']).length, 1); assert.deepEqual(hits('bananas', ['Chiquita Bananas']).length, 1);
  assert.deepEqual(hits('chicken thighs', ['Boneless Chicken Breast or Thighs']).length, 1); assert.deepEqual(hits('tomatoes', ['Plum Roma Tomatoes']).length, 1); });
test('matcher: picks the cheapest valid item per store', () => {
  const m = match('butter', [{ item: 'Peanut Butter', price: 1, store: 'A' }, { item: 'Cabot Butter', price: 3, store: 'A' }, { item: 'Kerrygold Butter', price: 4, store: 'A' }]);
  assert.equal(m.byStore.A.item, 'Cabot Butter'); });
