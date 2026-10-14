const { fetchLive, STORES, flyerUrl, enrichAlcohol } = require('../lib/flipp');
const relink = u => { const m = /^https:\/\/flipp\.com\/flyer\/(\d+)$/.exec(u || ''); return m ? flyerUrl(m[1]) : u; }; // same flyer, en-us viewer path (see lib/flipp.js)
const fs = require('fs'), path = require('path');
const Cond = require('../conditions.js');
const readJ = f => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8')); } catch { return null; } };
// conditional-price labels (multi-buy, must buy N, digital coupon, limits…) from Flipp item-detail text + hand-checked overrides
function addConditions(deals) {
  const det = (readJ('item_details.json') || {}).items || {}, ov = readJ('condition_overrides.json') || {}, at = (readJ('item_details.json') || {}).fetched_at || null;
  for (const d of deals) { const id = String(d.flipp_item_id || ''); const c = Cond.detect(d, det[id], ov[id]);
    if (c) { c.detail_url = det[id] ? `https://backflipp.wishabi.com/flipp/items/${id}` : null; c.detail_fetched_at = det[id] ? at : null; if (ov[id]) c.override = { basis: ov[id].basis, image: ov[id].image }; d.cond = c; } else delete d.cond; }
}
module.exports = Object.assign(async (req, res) => {
  let out;
  try { out = await fetchLive(); } catch (e) { out = null; }
  // fall back per-store to committed snapshot (real scraped data, never fabricated)
  let snap = null;
  try { snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'deals.json'), 'utf8')); } catch {}
  if (!out) out = { stores: {}, deals: [], fetched_at: new Date().toISOString(), source: 'snapshot' };
  for (const s of Object.keys(STORES)) {
    const st = out.stores[s];
    if ((!st || st.status !== 'ok') && snap && snap.stores[s] && snap.stores[s].status === 'ok' && new Date(snap.stores[s].valid_to) >= new Date()) {
      out.stores[s] = { ...snap.stores[s], from_snapshot: snap.fetched_at };
      out.deals.push(...snap.deals.filter(d => d.store === s).map(d => ({ ...d, source_url: relink(d.source_url) })));
      out.stores[s].source_url = relink(out.stores[s].source_url);
    } else if (!st) out.stores[s] = { status: 'unavailable', reason: 'fetch failed' };
  }
  // web-priced stores (cached basket from the store's own site) replace flyer data when available
  try {
    const w = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'web_samsclub.json'), 'utf8'));
    if (w.items.length && !w.blocked) {
      out.deals = out.deals.filter(d => d.store !== w.store);
      out.deals.push(...w.items);
      out.stores[w.store] = { status: 'ok', source: 'web', count: w.items.length, fetched_at: w.fetched_at, note: w.note, unpriced: w.unpriced, source_url: 'https://www.samsclub.com' };
    }
  } catch {}
  out.stores['Walmart'] = { ...(out.stores['Walmart'] || {}), web_status: 'blocked by site', web_reason: 'walmart.com redirects plain requests to a PerimeterX captcha (/blocked) on the first request; showing weekly flyer instead' };
  if (!out.stores["Sam's Club"] || out.stores["Sam's Club"].source !== 'web') out.stores["Sam's Club"] = { ...(out.stores["Sam's Club"] || {}), web_status: 'blocked by site', web_reason: 'samsclub.com sent a PerimeterX are-you-human captcha after 2 slow (4s-spaced) search requests; showing weekly flyer instead' };
  out.stores['Aldi'] = { ...(out.stores['Aldi'] || {}), web_status: 'not used', web_reason: 'aldi.us has no server-rendered search page (404); flyer used' };
  out.stores["Shaw's"] = { ...(out.stores["Shaw's"] || {}), web_status: 'not used', web_reason: "shaws.com prices are client-rendered and store-specific; flyer used" };
  for (const [k, v] of Object.entries(out.stores)) if (v.status === 'ok' && !v.source) v.source = 'flyer';
  try { await enrichAlcohol(out.deals); } catch {} // snapshot-fallback deals get Beer & Wine pack sizes too
  try { addConditions(out.deals); } catch {}
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  res.status(200).end(JSON.stringify(out));
}, { addConditions });
