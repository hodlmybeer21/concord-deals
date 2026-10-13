// Builds the weekly digest from live deals (same source as /api/deals) + recipes. Never invents prices.
// Freshness: a deal is used only if it is still valid at least FRESH_MS after the send (nothing that expires within ~a day).
// Midweek (Wednesday) sends only cover flyers that started after the previous Sunday, so they don't repeat Sunday's email.
const Meals = require('../meals.js');
const R = require('../data/recipes.json'), E = require('../data/price_estimates.json');
const { SITE } = require('./email');
const FRESH_MS = 36 * 36e5;
function getDeals() { return new Promise((resolve, reject) => { const h = require('../api/deals.js'); const res = { setHeader() {}, status() { return this; }, end(s) { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } } }; h({}, res).catch(reject); }); }
const fmtD = s => new Date(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
const etDay = t => new Date(new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay();
function isMidweek(now) { return etDay(now) === 3; }
function lastSunday(now) { const d = new Date(now); for (let i = 0; i < 7 && etDay(d) !== 0; i++) d.setTime(d - 864e5); return d; }
async function buildDigest(data, opts = {}) {
  if (!data && opts.now) { try { data = await require('./flipp').fetchLive(new Date(opts.now)); for (const v of Object.values(data.stores)) if (v.status === 'ok') v.source = 'flyer'; } catch { data = null; } } // dry-run at a simulated time: flyers live on Flipp for that moment
  data = data || await getDeals();
  const now = opts.now ? new Date(opts.now) : new Date(), cutoff = new Date(+now + FRESH_MS), midweek = opts.midweek ?? isMidweek(now);
  const sinceSun = new Date(lastSunday(now).toISOString().slice(0, 10) + 'T12:00:00Z'); // Sunday noon UTC ≈ after the Sunday send
  const fresh = d => { const s = data.stores[d.store]; const to = d.valid_to || (s && s.valid_to); return to && new Date(to) >= cutoff && (!d.valid_from || new Date(d.valid_from) <= cutoff); };
  const stores0 = {}; for (const [k, v] of Object.entries(data.stores)) stores0[k] = { ...v };
  const skipped = [];
  for (const [k, v] of Object.entries(stores0)) if (v.status === 'ok' && !(new Date(v.valid_to) >= cutoff)) { skipped.push({ store: k, reason: `flyer ends ${fmtD(v.valid_to)}, within a day of sending` }); v.status = 'expired'; }
  const deals = data.deals.filter(d => stores0[d.store] && stores0[d.store].status === 'ok' && fresh(d));
  const isNew = s => midweek ? new Date(stores0[s].valid_from) >= sinceSun : true;
  const meals = Meals.priceAll(R.recipes, deals, E, stores0);
  const used = new Map();
  for (const m of meals) for (const l of m.lines) if (l.type === 'deal' && l.cost > 0) { const k = l.deal.flipp_item_id || l.deal.item + l.store; const u = used.get(k) || { deal: l.deal, r: new Set() }; u.r.add(m.recipe.name); used.set(k, u); }
  const stores = [];
  for (const [s, st] of Object.entries(stores0)) {
    if (st.status === 'ok' && !isNew(s)) { skipped.push({ store: s, reason: 'already in Sunday\'s email (flyer started before Sunday)' }); continue; }
    if (st.status !== 'ok') { if (st.status !== 'expired' && !midweek) stores.push({ store: s, dates: 'unavailable', deals: [] }); continue; }
    const picks = [...used.values()].filter(u => u.deal.store === s && !u.deal.flag && u.deal.unit).sort((a, b) => b.r.size - a.r.size || a.deal.price - b.deal.price).slice(0, 4);
    stores.push({ store: s, dates: `${fmtD(st.valid_from)}–${fmtD(st.valid_to)}`, available: true, flyer: st.source_url,
      deals: picks.map(u => ({ item: u.deal.item, price_text: u.deal.price_text, unit: u.deal.unit, source: u.deal.source || 'flyer', source_url: u.deal.source_url, valid_to: u.deal.valid_to || st.valid_to, why: `in ${u.r.size} of this week's meals` })) });
  }
  let pool = meals; if (midweek) { const newStores = new Set(stores.map(s => s.store)); pool = meals.filter(m => Object.keys(m.byStore).some(s => newStores.has(s))); }
  pool = pool.filter(m => m.nDeal >= 2); // a meal must be built mostly on still-valid deals
  const full = pool.filter(m => !m.partial), part = pool.filter(m => m.partial);
  const chosen = full.slice(0, 5).concat(part.slice(0, Math.max(0, 5 - full.length)));
  const top = chosen.map(m => ({ name: m.recipe.name, total: m.total, partial: m.partial, est: m.nEst > 0, stores: Object.keys(m.byStore).join(' + '), url: `${SITE}/#meal-${meals.indexOf(m)}` }));
  const ok = stores.filter(s => s.available);
  const fetched = new Date(data.fetched_at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const range = ok.length ? `${midweek ? 'Midweek update: new flyers' : 'Flyers'} good through at least ${fmtD(cutoff)}` : 'No current flyers';
  const meal0 = top[0];
  return { midweek, sendAt: now.toISOString(), cutoff: cutoff.toISOString(), range, fetched, stores, skipped, meals: top,
    empty: !ok.some(s => s.deals.length) && !top.length,
    headline: midweek ? `Midweek: new ${ok.filter(s => s.deals.length).map(s => s.store).join(' & ') || 'flyer'} deals${meal0 ? `, ${meal0.name} $${meal0.total.toFixed(2)}` : ''}` : (meal0 ? `${meal0.name} for $${meal0.total.toFixed(2)} and this week's best flyer deals` : "This week's best flyer deals") };
}
module.exports = { buildDigest, getDeals, FRESH_MS, isMidweek };
