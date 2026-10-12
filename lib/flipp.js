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

async function fetchLive(now = new Date()) {
  const list = await getJSON(`${BASE}/flyers?locale=en-us&postal_code=${POSTAL}`);
  const flyers = Array.isArray(list) ? list : (list.flyers || []);
  const stores = {}, deals = [];
  for (const [store, re] of Object.entries(STORES)) {
    const f = pickFlyer(flyers, re, now);
    if (!f) { stores[store] = { status: 'unavailable', reason: 'No current weekly flyer on Flipp for 03301' }; continue; }
    try {
      const d = await getJSON(`${BASE}/flyers/${f.id}?locale=en-us`);
      const src = `https://flipp.com/flyer/${f.id}`;
      let n = 0;
      for (const it of d.items || []) {
        const p = it.price != null && it.price !== '' ? Number(it.price) : NaN;
        if (!it.name || !isFinite(p) || p <= 0) continue;
        const pre = it.pre_price_text || '', post = it.post_price_text || '';
        deals.push({ item: it.name.trim(), price: p, price_text: `${pre}$${p.toFixed(2)}${post ? ' ' + post : ''}`.trim(),
          unit: post || null, store, valid_from: it.valid_from || f.valid_from, valid_to: it.valid_to || f.valid_to, source_url: src });
        n++;
      }
      stores[store] = n ? { status: 'ok', flyer_id: f.id, valid_from: f.valid_from, valid_to: f.valid_to, count: n, source_url: src }
                        : { status: 'unavailable', reason: 'flyer had no readable prices' };
    } catch (e) { stores[store] = { status: 'unavailable', reason: String(e.message) }; }
  }
  return { stores, deals, fetched_at: new Date().toISOString(), source: 'live' };
}
module.exports = { fetchLive, STORES };
