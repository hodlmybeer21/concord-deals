import { createRequire } from 'module'; import fs from 'fs';
const req = createRequire(import.meta.url); const { fetchLive, fetchDetails } = req('../lib/flipp.js'); const { writeHistory } = req('../lib/history.js');
const histOnly = process.argv.includes('--history-only'); // CI: record history without replacing the unit-resolved snapshot
const d = await fetchLive(); if (!histOnly) fs.writeFileSync(new URL('../data/deals.json', import.meta.url), JSON.stringify(d));
console.log(Object.entries(d.stores).map(([k, v]) => `${k}: ${v.status} ${v.count || ''}`).join('\n'));
if (!process.argv.includes('--no-details')) { // conditional-price text (multi-buy, must-buy, coupons, limits) for every deal
  const det = await fetchDetails(d.deals); const f = new URL('../data/item_details.json', import.meta.url);
  if (det.ok >= det.requested * 0.8) { fs.writeFileSync(f, JSON.stringify(det)); console.log(`item details: ${det.ok}/${det.requested} ok`); }
  else console.log(`item details: only ${det.ok}/${det.requested} ok; kept previous data/item_details.json`);
}
console.log('history:', writeHistory(d)); // data/history/YYYY-MM-DD.json, raw flyer rows for future price history
// After a fresh snapshot, run: node scripts/resolve_units.mjs
