// Builds the weekly digest data from live deals (same source as /api/deals) + recipes. Never invents prices.
const path = require('path');
const Meals = require('../meals.js');
const R = require('../data/recipes.json'), E = require('../data/price_estimates.json');
const { SITE } = require('./email');
function getDeals() { return new Promise((resolve, reject) => { const h = require('../api/deals.js'); const res = { setHeader() {}, status() { return this; }, end(s) { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } } }; h({}, res).catch(reject); }); }
const fmtD = s => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
async function buildDigest(data) {
  data = data || await getDeals();
  const meals = Meals.priceAll(R.recipes, data.deals, E, data.stores);
  const used = new Map(); // deal key -> {deal, recipes:Set}
  for (const m of meals) for (const l of m.lines) if (l.type === 'deal' && l.cost > 0) { const k = l.deal.flipp_item_id || l.deal.item + l.store; const u = used.get(k) || { deal: l.deal, r: new Set() }; u.r.add(m.recipe.name); used.set(k, u); }
  const stores = [];
  for (const [s, st] of Object.entries(data.stores)) {
    const dates = st.status === 'ok' ? `${fmtD(st.valid_from)}–${fmtD(st.valid_to)}` : 'unavailable';
    if (st.status !== 'ok') { stores.push({ store: s, dates, deals: [] }); continue; }
    const picks = [...used.values()].filter(u => u.deal.store === s && !u.deal.flag && u.deal.unit).sort((a, b) => b.r.size - a.r.size || a.deal.price - b.deal.price).slice(0, 4)
      .map(u => ({ ...u.deal, why: `in ${u.r.size} of this week's meals` }));
    stores.push({ store: s, dates, available: true, flyer: st.source_url, deals: picks.map(d => ({ item: d.item, price_text: d.price_text, unit: d.unit, source: d.source || 'flyer', source_url: d.source_url, why: d.why })) });
  }
  const top = meals.slice(0, 5).map(m => ({ name: m.recipe.name, total: m.total, partial: m.partial, est: m.nEst > 0, stores: Object.keys(m.byStore).join(' + '), url: `${SITE}/#meal-${meals.indexOf(m)}` }));
  const ok = Object.values(data.stores).filter(s => s.status === 'ok');
  const range = ok.length ? `Flyers ${fmtD(ok.map(s => s.valid_from).sort()[0])}–${fmtD(ok.map(s => s.valid_to).sort().slice(-1)[0])}` : 'No flyers available';
  const fetched = new Date(data.fetched_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return { range, fetched, stores, meals: top, headline: top[0] ? `${top[0].name} for $${top[0].total.toFixed(2)} and this week's best flyer deals` : "This week's best flyer deals" };
}
module.exports = { buildDigest, getDeals };
