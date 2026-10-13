// Units resolved offline by scripts/resolve_units.mjs from Flipp item-detail fields / flyer images (keyed by Flipp item id).
let UNITS = {}; try { UNITS = require('../data/units.json'); } catch {}
const BASE = 'https://backflipp.wishabi.com/flipp';
const POSTAL = '03301';
const STORES = {
  'Market Basket': /market basket/i,
  'Hannaford': /^hannaford/i,
  'Aldi': /^aldi\b/i,
  "Shaw's": /^shaw'?s\b/i,
  "Sam's Club": /^sam'?s club/i,
  'Walmart': /^walmart\b/i,
};

// Deep-link form checked in headed Chromium: /en-us/flyer/<id> opens the flyer viewer; item-level links never showed the item. Flipp also served error pages to this box intermittently.
const flyerUrl = id => `https://flipp.com/en-us/flyer/${id}?postal_code=${POSTAL}`;
const httpsImg = u => (u && /^https?:\/\/f\.wishabi\.net\//.test(u)) ? u.replace(/^http:/, 'https:') : null;
async function getJSON(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 concord-deals' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

function pickFlyer(flyers, re, now) {
  const c = flyers.filter(f => re.test(f.merchant || '') &&
    new Date(f.valid_from) <= now && new Date(f.valid_to) >= now &&
    (f.categories || []).some(x => /grocer/i.test(x)));
  const pool = c.length ? c : flyers.filter(f => re.test(f.merchant || '') && new Date(f.valid_to) >= now && new Date(f.valid_from) <= now);
  // prefer the weekly ad (shortest validity window) over multi-week books; then shortest merchant name (dedupe aliases)
  const span = f => new Date(f.valid_to) - new Date(f.valid_from);
  return pool.sort((a, b) => span(a) - span(b) || a.merchant.length - b.merchant.length)[0];
}

// Beer & Wine: pack sizes and the flyer's own label wording come from Flipp's item-detail endpoint (description, sale_story, disclaimer_text).
const Alcohol = require('../alcohol.js');
async function enrichAlcohol(deals) {
  const todo = deals.filter(d => !d.alc && d.flipp_item_id && Alcohol.classify(d.item));
  await Promise.all(todo.map(async d => {
    const url = `${BASE}/items/${d.flipp_item_id}?locale=en-us`; let info = null;
    try { const j = await getJSON(url); info = j.item || j; } catch { info = null; }
    const a = Alcohol.describe(d, info); if (!a) return;
    d.alc = { ...a, detail_url: info ? `${BASE}/items/${d.flipp_item_id}` : null, detail_fetched_at: new Date().toISOString() };
    if (a.unit) { d.unit = a.unit; d.unit_source = `${BASE}/items/${d.flipp_item_id} fields name + description${info && info.description ? ': "' + String(info.description).replace(/\s+/g, ' ').trim() + '"' : ''}`; d.flag = null; }
    else { d.unit = null; d.unit_source = null; d.flag = info ? a.flag : 'pack size unconfirmed: Flipp item details unavailable'; }
  }));
  return deals;
}
async function fetchLive(now = new Date()) {
  const fetched_at = new Date().toISOString();
  const list = await getJSON(`${BASE}/flyers?locale=en-us&postal_code=${POSTAL}`);
  const flyers = Array.isArray(list) ? list : (list.flyers || []);
  const stores = {}, deals = [];
  for (const [store, re] of Object.entries(STORES)) {
    const f = pickFlyer(flyers, re, now);
    if (!f) { stores[store] = { status: 'unavailable', reason: 'No current weekly flyer on Flipp for 03301' }; continue; }
    try {
      const d = await getJSON(`${BASE}/flyers/${f.id}?locale=en-us`);
      const src = flyerUrl(f.id);
      let n = 0;
      for (const it of d.items || []) {
        const p = it.price != null && it.price !== '' ? Number(it.price) : NaN;
        if (!it.name || !isFinite(p) || p <= 0) continue;
        const pre = it.pre_price_text || '', post = it.post_price_text || '';
        const u = UNITS[it.id];
        deals.push({ item: it.name.trim(), price: p, price_text: `${pre}$${p.toFixed(2)}${post ? ' ' + post : ''}`.trim(),
          unit: u ? u.unit : (post || null), unit_source: u ? u.unit_source : (post ? `${BASE}/flyers/${f.id} field post_price_text` : null), flipp_item_id: it.id, image_url: httpsImg(it.cutout_image_url), store, valid_from: it.valid_from || f.valid_from, valid_to: it.valid_to || f.valid_to, source_url: src, source: 'flyer', fetched_at,
          flag: (u || post) ? null : 'unit not stated in flyer (per-lb vs each unclear)' });
        n++;
      }
      stores[store] = n ? { status: 'ok', flyer_id: f.id, valid_from: f.valid_from, valid_to: f.valid_to, count: n, source_url: src }
                        : { status: 'unavailable', reason: 'flyer had no readable prices' };
    } catch (e) { stores[store] = { status: 'unavailable', reason: String(e.message) }; }
  }
  await enrichAlcohol(deals);
  return { stores, deals, fetched_at: new Date().toISOString(), source: 'live' };
}
module.exports = { fetchLive, STORES, flyerUrl, httpsImg, enrichAlcohol };
