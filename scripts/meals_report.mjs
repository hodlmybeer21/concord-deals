import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const D = require('../data/deals.json'), R = require('../data/recipes.json'), E = require('../data/price_estimates.json');
const M = require('../meals.js');
const out = M.priceAll(R.recipes, D.deals, E, D.stores);
for (const m of out) { console.log(`\n${m.recipe.name} $${m.total.toFixed(2)}${m.partial?' (partial)':''} d${m.nDeal} e${m.nEst} u${m.nUnk} ${m.wellMatched?'OK':'WEAK'}`);
  if (process.argv[2]) for (const l of m.lines) console.log('  ', l.type.padEnd(8), l.ing.name.padEnd(22), l.cost??'?', l.deal ? `${l.store}: ${l.deal.item.slice(0,50)} [${l.deal.unit}] ${l.share}` : `${l.why} ${l.share||''}`); }
const t = k => out.reduce((a, m) => a + m[k], 0);
console.log('\nrecipes', out.length, 'well', out.filter(m => m.wellMatched).length, 'deal', t('nDeal'), 'est', t('nEst'), 'unk', t('nUnk'));
