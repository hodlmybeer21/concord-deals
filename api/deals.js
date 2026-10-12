const { fetchLive, STORES } = require('../lib/flipp');
const fs = require('fs'), path = require('path');
module.exports = async (req, res) => {
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
      out.deals.push(...snap.deals.filter(d => d.store === s));
    } else if (!st) out.stores[s] = { status: 'unavailable', reason: 'fetch failed' };
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
  res.status(200).end(JSON.stringify(out));
};
