(function (root) {
  const STOP = new Set(['the','a','of','and','or','with','oz','lb','lbs','ct','pk','pack','fl','select','varieties','assorted','fresh','each','or']);
  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ches|shes|xes|oes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }
  function toks(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w)).map(stem); }
  // Whole-word matching. A query word only counts when it is the product itself, not part of a compound item:
  // "butter" ≠ peanut butter / apple butter / butter cookies; "chicken" ≠ chicken broth; "cream" ≠ ice cream / cream cheese.
  // Neighbours that are themselves in the query are allowed ("peanut butter" still matches peanut butter).
  const BEFORE = { // word before the query word that turns it into a different product
    butter: ['peanut','apple','almond','cashew','sunflower','cookie','shea','cocoa','body','nut','pumpkin','seed','soy'],
    milk: ['coconut','almond','oat','soy','rice','cashew','condensed','evaporated','chocolate','body','powdered'],
    cream: ['ice','sour','orange','repair','conditioning','moisturizing','night','day','whip','styling','curl','diaper','rash','whipped','shaving','hand','body','face','eye','coffee','sun','heavy_'],
    corn: ['pop','candy','baby_','cracked'],
    bacon: ['chicken','turkey','veggie','vegan'], banana: ['powder','baking'], cheese: ['cream','mac','macaroni','three','four','nacho'], coffee: ['mr'], egg: ['chocolate','candy','easter','plastic'], apple: ['pine','crab_'],
    chicken: ['buffalo_','imitation'], beef: ['corned_'], rice: ['cauliflower'], bean: ['jelly','coffee','vanilla'],
    bread: ['corn','shortbread','ginger'], pepper: ['dr','black','white','cayenne','lemon'], potato: ['sweet_'], orange: ['blood_'],
    tomato: [], onion: ['green_'], sugar: ['cotton'], juice: [], water: ['coconut','rose','tonic'], ham: ['graham'],
  };
  const AFTER = { // word after it that makes a different product
    butter: ['cookie','cracker','pecan','chicken','lettuce','bean','croissant','popcorn','toffee','finger','braid','cup','candy','spread','flavored','flavor','squash','rum'],
    milk: ['chocolate','bone','duds','bath','lotion','shake','thistle','bar','maid'],
    cream: ['cheese','soda','pie','puff','filled','liqueur','corn','sandwich','of'],
    chicken: ['broth','stock','soup','bouillon','base','flavor','flavored','noodle','nugget','tender','strip','sausage','salad','pot','dog','food','treat','sauce','seasoning','rice','ramen','gravy','burger','patty','dumpling','fried','sea','chowder'],
    corn: ['chowder','flake','chip','starch','syrup','dog','muffin','bread','meal','tortilla','nut','pop','oil','cob_'],
    beef: ['broth','stock','jerky','bouillon','base','flavor','flavored','stick','ramen','gravy','seasoning'],
    egg: ['noodle','roll','nog','white_','substitute','bite','salad'], apple: ['juice','sauce','butter','pie','chip','cider','vinegar','strudel','jack','airpod','watch','ipad','iphone','macbook','pencil','tv','gift','music'],
    orange: ['juice','chicken','soda','marmalade','drink'], tomato: ['sauce','paste','soup','ketchup','juice'], potato: ['chip','salad','bread','roll','starch','skin'],
    banana: ['bread','pepper','chip','pudding'], coffee: ['creamer','cake','mate','filter','maker','pod_','espresso','table','mug'], cheese: ['pizza','chip','tortilla','snack','cracker_','cake','cracker','puff','dip','stick','its','curl','ball','sauce','danish'],
    bread: ['crumb','stuffing','pudding'], rice: ['cake','krispie','cereal','noodle','vinegar','milk','cracker','pudding','a','cooker'],
    onion: ['ring','soup','dip','powder','chip'], pepper: ['jack','mill','sauce','flake','corn','steak'], peanut: ['butter_'], bean: ['sprout_','dip'],
    ham: ['burger'], sugar: ['free','snap','cookie','cone'], water: ['melon','chestnut','cress','enhancer'], juice: ['box_'], milkshake: [],
  };
  // whole item is a non-grocery product (appliance, cosmetics, electronics) unless the query asks for it
  const NONFOOD = new Set([].concat(['maker','machine','cooker','grinder','blender','airpod','conditioner','conditioning','shampoo','lotion','candle','leave','deodorant','toothpaste','fryer','kettle','toaster','vacuum','charger','headphone','speaker']).map(w => stem(w)));
  const nonFood = (d, qset) => d.some(w => NONFOOD.has(w) && !qset.has(w));
  for (const T of [BEFORE, AFTER]) for (const k of Object.keys(T)) T[k] = [...new Set(T[k].flatMap(w => [stem(w), stem(w + "s")]))]; // compare in the same stemmed form as item tokens
  const okAt = (d, i, qset) => { const w = d[i], b = d[i - 1], a = d[i + 1];
    if (b && (BEFORE[w] || []).includes(b) && !qset.has(b)) return false; if (a && (AFTER[w] || []).includes(a) && !qset.has(a)) return false; return true; };
  // score: fraction of query words found as whole words (after stemming) in a non-compound position
  function score(q, d) {
    if (!q.length) return 0; const qset = new Set(q); if (nonFood(d, qset)) return 0; let hit = 0;
    for (const t of q) { let ok = false; for (let i = 0; i < d.length && !ok; i++) if (d[i] === t && okAt(d, i, qset)) ok = true; if (ok) hit++; }
    return hit / q.length;
  }
  // Beer & Wine: alcohol items get their category words ("beer", "wine", "cider", "seltzer") as extra search terms.
  // An alcohol query ("beer", "wine", "cider", "ipa"…) only returns alcohol items (no wine vinegar / apple cider doughnuts),
  // and generic grocery queries ("lemonade", "tea", "juice") don't return alcohol items unless they name a brand.
  const ALQ = new Set(['beer','wine','cider','seltzer','ipa','lager','ale','stout','pilsner','merlot','cabernet','chardonnay','pinot','sauvignon','riesling','prosecco','champagne','moscato','malbec','zinfandel','sangria','rose','rosé','hard','boxed','rtd'].map(stem));
  const NOTALQ = new Set(['root','ginger','birch','cooking','vinegar','glass','sparkling','water','apple','doughnut','donut'].map(stem));
  const GENERIC = new Set(['lemonade','tea','juice','soda','water','lemon','lime','orange','cranberry','grapefruit','peach','mango','cherry','berry','black','white','red','light','ultra','box','pack','can','vodka','cream','apple','punch','cola'].map(stem));
  const AL = () => root.Alcohol || (typeof require !== 'undefined' ? (() => { try { return require('./alcohol.js'); } catch { return null; } })() : null);
  function isAlc(d) { if (d._alc === undefined) { const A = AL(); d._alc = !!(d.alc || (A && A.classify(d.item))); } return d._alc; }
  function match(query, deals) {
    const q = toks(query); const byStore = {};
    const alcQ = q.some(w => ALQ.has(w)) && !q.some(w => NOTALQ.has(w)), brandish = q.some(w => !GENERIC.has(w) && !ALQ.has(w));
    for (const d of deals) {
      if (!d._t) { const a = isAlc(d), A = AL(); const c = a && (d.alc || (A && A.classify(d.item))); d._t = toks(d.item + (c ? ' ' + c.kw : '')); }
      if (alcQ && !isAlc(d)) continue; if (!alcQ && isAlc(d) && !brandish) continue;
      const s = score(q, d._t); if (s < 1 && !(q.length > 2 && s >= 0.67)) continue;
      const cur = byStore[d.store];
      if (!cur || d.price < cur.price) byStore[d.store] = Object.assign({ score: s }, d);
    }
    const list = Object.values(byStore).sort((a, b) => a.price - b.price);
    return { query, byStore, best: list[0] || null };
  }
  root.DealMatch = { match, toks };
  if (typeof module !== 'undefined') module.exports = root.DealMatch;
})(typeof window !== 'undefined' ? window : globalThis);
