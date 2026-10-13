import { createRequire } from 'module'; import fs from 'fs';
const req = createRequire(import.meta.url); const { fetchLive } = req('../lib/flipp.js'); const { writeHistory } = req('../lib/history.js');
const histOnly = process.argv.includes('--history-only'); // CI: record history without replacing the unit-resolved snapshot
const d = await fetchLive(); if (!histOnly) fs.writeFileSync(new URL('../data/deals.json', import.meta.url), JSON.stringify(d));
console.log(Object.entries(d.stores).map(([k, v]) => `${k}: ${v.status} ${v.count || ''}`).join('\n'));
console.log('history:', writeHistory(d)); // data/history/YYYY-MM-DD.json, raw flyer rows for future price history
// After a fresh snapshot, run: node scripts/resolve_units.mjs
