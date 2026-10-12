// Pass 1: resolve units for data/deals.json from Flipp item-detail fields. Throttled + cached.
import fs from 'fs'; import { createRequire } from 'module';
const require = createRequire(import.meta.url); const { resolveUnit, resolveFromName } = require('../lib/units.js');
const BASE = 'https://backflipp.wishabi.com/flipp', UA = { 'User-Agent': 'Mozilla/5.0 concord-deals' };
const C = '.cache'; fs.mkdirSync(`${C}/flyers`, { recursive: true }); fs.mkdirSync(`${C}/items`, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function cached(path, url) {
  if (fs.existsSync(path)) return JSON.parse(fs.readFileSync(path, 'utf8'));
  await sleep(400); const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json(); fs.writeFileSync(path, JSON.stringify(j)); return j;
}
const data = JSON.parse(fs.readFileSync('data/deals.json', 'utf8'));
const OV = JSON.parse(fs.readFileSync('data/unit_overrides.json', 'utf8'));
const stats = {}; const map = {};
for (const [store, s] of Object.entries(data.stores)) {
  if (!s.flyer_id) continue;
  const fl = await cached(`${C}/flyers/${s.flyer_id}.json`, `${BASE}/flyers/${s.flyer_id}?locale=en-us`);
  const pool = [...(fl.items || [])];
  for (const d of data.deals.filter(x => x.store === store)) {
    const st = stats[store] ||= { total: 0, resolved: 0, no_match: 0, fetch_err: 0 }; st.total++;
    const i = pool.findIndex(it => (it.name || '').trim() === d.item && Number(it.price) === d.price);
    if (i < 0) { st.no_match++; continue; }
    const it = pool.splice(i, 1)[0]; d.flipp_item_id = it.id;
    let det; try { det = await cached(`${C}/items/${it.id}.json`, `${BASE}/items/${it.id}`); } catch { st.fetch_err++; continue; }
    let r = resolveUnit(det.item || det); const ov = OV[it.id] && OV[it.id].unit ? OV[it.id] : null;
    if (!r && !ov && (store === 'Walmart' || store === "Sam's Club")) {
      const n = resolveFromName(d.item);
      if (n) { d.unit = n.unit; d.unit_source = `item name: "${d.item}" (states "${n.text.trim()}") via ${BASE}/items/${it.id}`; d.flag = null; st.resolved++; st.by_name = (st.by_name || 0) + 1; map[it.id] = { unit: d.unit, unit_source: d.unit_source }; continue; }
    }
    if (r || ov) {
      d.unit = r ? r.unit : ov.unit;
      d.unit_source = r ? `${BASE}/items/${it.id} field ${r.field}: "${r.text.replace(/\s+/g, ' ').slice(0, 120)}"` : `${ov.image} (flyer image read: ${ov.note})`;
      if (r && ov) d.unit_source += ` | confirmed by flyer image ${ov.image}: ${ov.note}`;
      if (r && ov && r.unit !== ov.unit) { d.unit = null; d.unit_source = null; d.flag = `conflicting unit sources (${r.unit} vs ${ov.unit})`; st.total; continue; }
      map[it.id] = { unit: d.unit, unit_source: d.unit_source };
      if (ov && !r) st.by_image = (st.by_image || 0) + 1;
      d.flag = null; st.resolved++;
    } else { d.unit = null; d.unit_source = null; d.flag = 'unit not stated in flyer (per-lb vs each unclear)'; }
    if (0) { d.unit = null; d.unit_source = null; d.flag = 'unit not stated in flyer (per-lb vs each unclear)'; }
  }
}
fs.writeFileSync('data/units.json', JSON.stringify(map));
fs.writeFileSync('data/deals.json', JSON.stringify(data));
console.log(JSON.stringify(stats, null, 1));
