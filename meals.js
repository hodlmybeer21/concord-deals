// Meals engine: prices recipes from this week's flyer deals. Never invents prices.
// Deal used only if its unit is confirmed (no flag) and cost is computable; otherwise a cited BLS estimate; otherwise "price unknown".
(function (root) {
  const DM = root.DealMatch || (typeof require !== 'undefined' ? require('./match.js') : null);
  // prepared/processed foods that should never stand in for a raw ingredient (unless the query names them)
  const BLOCK = ['chip','pie','soup','sandwich','nugget','dip','salad','burger','juice','cider','candy','muffin','bar','waffle','pancake','cake','doughnut','strudel','breaded','wine','entree','dinner','bite','popcorn','cookie','pop','treat','gummy','croissant','biscuit','patty','pattie','dipper','cooked','mix','filled','wrap','bowl','meal','kit','cup','snack','marinade','seasoned','glazed','rubbed','stuffed','parmesan','frozen','pizza','dog','crab','lunch','pulled','spread'];
  const r2 = n => Math.round(n * 100) / 100;
  function dealUnit(d) {
    const u = String(d.unit || '').toLowerCase().trim();
    if (!u) return null;
    if (/^(\/\s*)?(per\s+)?lbs?\.?$/.test(u)) return { kind: 'lb' };
    let m = u.match(/^(\d+)\s*\/\s*\$/); if (m) return { kind: 'multi', n: +m[1] };
    if (/^(each|ea\.?)$/.test(u)) return { kind: 'each' };
    if (u === 'dozen') return { kind: 'pkg', ct: 12, label: 'dozen' };
    m = u.match(/(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)?\s*-?\s*(fl\.?\s*oz|oz|lbs?|ct|count|pack)\b/);
    if (m) { const v = +m[1], k = m[2].replace(/\s/g, ''); const label = u.replace(/^per\s+/, '').replace(/\.$/, '');
      if (k === 'oz' || k === 'fl.oz' || k === 'floz') return { kind: 'pkg', oz: v, label };
      if (k.startsWith('lb')) return { kind: 'pkg', oz: v * 16, label };
      return { kind: 'pkg', ct: v, label }; }
    return { kind: 'pkg', label: u };
  }
  const W = { lb: 16, oz: 1 }, C = { each: 1, dozen: 12 };
  function need(ing) { if (W[ing.unit]) return { oz: ing.qty * W[ing.unit] }; if (C[ing.unit]) return { ct: ing.qty * C[ing.unit] }; if (ing.unit === 'cup') return { floz: ing.qty * 8 }; return { pk: ing.qty }; }
  const FR = [[1/8,'1/8'],[1/4,'1/4'],[1/3,'1/3'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4']];
  const frac = f => f >= 0.9 ? 'all' : '~' + FR.reduce((a, b) => Math.abs(b[0] - f) < Math.abs(a[0] - f) ? b : a)[1];
  const qtyTxt = ing => `${+ing.qty.toFixed(2)} ${ing.unit}`;
  function costFor(ing, d) {
    const u = dealUnit(d), n = need(ing); if (!u) return null;
    if (u.kind === 'lb') { if (n.oz == null) return null; return { cost: r2(d.price * n.oz / 16), share: `${qtyTxt(ing)} × $${d.price.toFixed(2)}/lb` }; }
    if (u.kind === 'each') { if (n.ct != null) return { cost: r2(d.price * n.ct), share: `${n.ct} × $${d.price.toFixed(2)} each` };
      if (n.pk != null) { const k = Math.ceil(n.pk - 1e-9); return { cost: r2(d.price * k), share: `${k} × $${d.price.toFixed(2)} each` }; } return null; }
    if (u.kind === 'multi') { // counts the whole multi-buy rule; only for count/package needs (size not stated)
      const q = n.ct != null ? n.ct : n.pk; if (q == null) return null; const k = Math.ceil(q / u.n - 1e-9);
      return { cost: r2(d.price * k), share: `uses ${q} of ${u.n * k} (${k > 1 ? k + ' × ' : ''}${d.unit} deal, counted in full)` }; }
    // package
    let size = null, have = null; if (u.oz && (n.oz != null || n.floz != null)) { size = u.oz; have = n.oz != null ? n.oz : n.floz; } else if (u.ct && n.ct != null) { size = u.ct; have = n.ct; }
    if (size) { const k = Math.max(1, Math.ceil(have / size - 0.03)); return { cost: r2(d.price * k), share: k > 1 ? `uses ${k} × ${u.label}` : `uses ${frac(have / size)} of ${u.label}` }; }
    if (n.pk != null) { const k = Math.ceil(n.pk - 1e-9); return { cost: r2(d.price * k), share: k > 1 ? `${k} × ${u.label}` : `1 × ${u.label}` }; }
    return null;
  }
  function candidates(ing, deals) {
    const q = DM.toks(ing.q || ing.name), not = (ing.not || []).map(w => DM.toks(w)[0]).filter(Boolean);
    const block = BLOCK.filter(b => !q.includes(b));
    return deals.filter(d => { const t = d._t || (d._t = DM.toks(d.item));
      return q.every(w => t.includes(w)) && !t.some(w => block.includes(w) || not.includes(w)); });
  }
  function estimateFor(ing, EST) {
    const e = ing.est && EST && EST.estimates[ing.est]; if (!e) return null; const n = need(ing); let amt = null;
    if (e.unit === 'lb' && n.oz != null) amt = n.oz / 16; else if (e.unit === 'dozen' && n.ct != null) amt = n.ct / 12;
    else if (e.unit === 'gal' && ing.unit === 'cup') amt = ing.qty / 16; else if (e.unit === '8 oz' && n.oz != null) amt = n.oz / 8;
    if (amt == null) return null; return { cost: r2(e.value * amt), est: e, share: `${qtyTxt(ing)} × $${e.value.toFixed(2)}/${e.unit} (${e.period} avg)` };
  }
  function price(recipe, deals, EST, stores) {
    const okStore = s => !stores || (stores[s] && stores[s].status === 'ok');
    const lines = [], pantry = [], used = {};
    for (const ing of recipe.ingredients) {
      if (ing.pantry) { pantry.push(ing.name); continue; }
      const cand = candidates(ing, deals).filter(d => okStore(d.store));
      let best = null; const flagged = cand.filter(d => d.flag);
      for (const d of cand) { if (d.flag) continue; const c = costFor(ing, d); if (c && (!best || c.cost < best.cost)) best = Object.assign({ deal: d }, c); }
      if (best) { const key = best.deal.flipp_item_id || best.deal.item + best.deal.store;
        if (used[key]) { best = Object.assign({}, best, { cost: 0, share: best.share + ' (same deal as above, counted once)' }); } used[key] = 1;
        lines.push({ ing, type: 'deal', cost: best.cost, share: best.share, deal: best.deal, store: best.deal.store }); continue; }
      const e = estimateFor(ing, EST);
      const why = flagged.length ? `flyer deal at ${flagged[0].store} has no confirmed unit` : cand.length ? 'deal size can\u2019t be compared' : 'no deal this week';
      if (e) lines.push({ ing, type: 'estimate', cost: e.cost, share: e.share, est: e.est, why });
      else lines.push({ ing, type: 'unknown', cost: null, why });
    }
    const byStore = {}; let total = 0, est = 0;
    for (const l of lines) { if (l.type === 'deal') { byStore[l.store] = r2((byStore[l.store] || 0) + l.cost); total += l.cost; } else if (l.type === 'estimate') { est += l.cost; total += l.cost; } }
    const nDeal = lines.filter(l => l.type === 'deal').length, nEst = lines.filter(l => l.type === 'estimate').length, nUnk = lines.filter(l => l.type === 'unknown').length;
    return { recipe, lines, pantry, byStore, estimateTotal: r2(est), total: r2(total), partial: nUnk > 0, nDeal, nEst, nUnk, wellMatched: nDeal >= 2 && nDeal / lines.length >= 0.5 };
  }
  function priceAll(recipes, deals, EST, stores) { return recipes.map(r => price(r, deals, EST, stores)).sort((a, b) => a.total - b.total); }
  root.Meals = { priceAll, price, dealUnit, candidates };
  if (typeof module !== 'undefined') module.exports = root.Meals;
})(typeof window !== 'undefined' ? window : globalThis);
