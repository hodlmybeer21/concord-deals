// Ingredient exclusions in data/recipes.json, checked against real flyer item names seen Oct 14-31, 2026.
const test = require('node:test'), assert = require('node:assert');
const M = require('../meals.js'), R = require('../data/recipes.json');
const ing = (recipe, name) => R.recipes.find(r => r.name === recipe).ingredients.find(i => i.name === name);
const hits = (i, items) => M.candidates(i, items.map(item => ({ item, price: 1, store: 'S' }))).map(d => d.item);
const cases = [ // [recipe, ingredient, wrong flyer items, right flyer items]
  ['Stuffed Acorn Squash', 'acorn squash', ['Spaghetti Squash', 'Peeled Butternut Squash', 'Yellow or Green Squash or Eggplant'], ['Butternut, Buttercup or Acorn Squash']],
  ['Roast Whole Chicken & Squash', 'winter squash', ['Spaghetti Squash', 'Yellow or Green Squash or Eggplant'], ['Winter Squash', 'Butternut Squash', 'FALL SQUASHES']],
  ['Chicken Parmesan Pasta', 'pasta sauce', ['Chef Boyardee Pasta 7.5-15 oz. Rotel & Hunts Tomatoes & Tomato Sauce'], ["Rao's Pasta Sauce", 'Ragu Pasta Sauce']],
  ['Chicken Parmesan Pasta', 'parmesan', ['Chicken Parmesan With Penne or Fusilli Pasta'], ['Emporium Selection Parmesan Cheese Wedge', "Milano's Grated Parmesan"]],
  ['Shepherd\'s Pie', 'potatoes', ['Taste of Inspirations Savory Garlic Potatoes', "Reser's Twice Baked Potatoes", 'Signature Select Potatoes Super Pretzel', 'Almond Breeze Milk 64 oz. Simply Potatoes 20 oz.'], ['Russet Potatoes', 'Hannaford Red Potatoes']],
  ['Ham Steak, Eggs & Potatoes', 'ham steak', ['Smithfield Diced, Cubed Ham or Ham Steaks'], ['Hatfield Boneless Ham Steak']],
  ['Lemon Garlic Chicken', 'lemons', ['Lemon Perfect', 'Clorox Disinfecting Wipes Bleach Free Cleaner Crisp Lemon 35 Count', 'Lysol Disinfecting Wipes Multi Surface Cleaner'], ['Hannaford Lemons']],
  ['Rotisserie Chicken Salad Wraps', 'grapes', ['Cherub Grape Tomatoes', "Member's Mark Children's Cetirizine Hydrochloride All Day Allergy Oral Solution Grape"], ['Red Seedless Grapes']],
  ['Rotisserie Chicken Salad Wraps', 'Greek yogurt', ['Chobani Complete Greek Yogurt Shake', 'Stonyfield Organic Greek Yogurt Drinks'], ['Chobani Greek Yogurt']],
  ['Pan-Seared Pork Chops & Apples', 'apples', ['Apple Airpods 5 Wireless Charging Case', 'Apple Watch Series 12 GPS 42mm Aluminum Case', 'Apple Jacks Cereal, 36.5 oz.', 'Cinnamon Apple Fritters', 'Apple Cinnamon Goat Cheese Log', 'When Pigs Fly Pumpkin Cranberry Apple Bread', 'Pepperidge Farm Goldfish Singles 2 oz. GoGo Squeez Apple 3.2 oz.'], ['Honeycrisp Apples', 'Tote Bag Apples']],
  ['Tuna Pasta Bake', 'milk', ["Member's Mark Milk Chocolate Pecan Caramel Clusters, 30.2 oz.", 'MARKET BASKET Whole Milk Shredded Mozzarella'], ['Stonyfield Organic Milk']],
  ['Veggie Frittata', 'eggs', ['Maola Egg Nog'], ["Nellie's Free Range Large Brown Eggs"]],
  ['Tuna Pasta Bake', 'tuna', ['Double Tuna Roll', 'Tuna Steaks'], ['Bumble Bee Solid White Tuna']],
  ['Cheeseburgers & Potato Wedges', 'hamburger buns', ['Wow Bao Buns', 'Bun Length Franks', "Clancy's Cinnamon Bun or Salted Caramel Pretzels"], ['12-Pack Hannaford Hamburger or Frankfurter Buns']],
  ['Bacon Potato Soup', 'bacon', ['ALL NATURAL TURKEY BACON', 'Canadian Style Bacon'], ['Smithfield Sliced Bacon']],
  ['Chicken Thigh Rice Bowls', 'boneless chicken thighs', ["Nathan's Beef Franks 11-12 oz. Amazing Taste Marinated Boneless Chicken Thighs"], ['Fresh Family Pack Boneless Skinless Chicken Thighs']],
  ['Sausage, Peppers & Onions', 'Italian sausage', ['Italian Turkey Sausage'], ['Perri Italian Sausage']],
  ['Pork Loin Roast & Squash', 'boneless pork loin', ['Pork Loin Assorted End Chops or Country Style Ribs'], ['Fresh Half Pork Loin', 'Fresh Boneless Pork Loin Chops or Roast']],
  ['Baked Salmon & Rice', 'salmon fillet', ['Bourbon Marinated Salmon'], ['Fresh Coho Salmon Fillet']],
  ['Sheet-Pan Chicken & Broccoli', 'boneless chicken breast', ['Fresh Marinated Chicken Breast'], ['Fresh Boneless Chicken Breast']],
  ['Sheet-Pan Chicken & Broccoli', 'broccoli', ['Mini Vegetable Tray with Broccoli And Carrots'], ['Hannaford Broccoli Florets']],
];
for (const [rec, name, bad, good] of cases) test(`recipes: ${name} (${rec}) skips wrong products, keeps the real one`, () => {
  const i = ing(rec, name); assert.ok(i, `${rec} / ${name} exists`);
  assert.deepEqual(hits(i, bad), [], `${name} must not match: ${hits(i, bad).join(' | ')}`);
  assert.deepEqual(hits(i, good), good, `${name} should still match all of: ${good.join(' | ')}`);
});
