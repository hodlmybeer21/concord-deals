import { createRequire } from 'module'; import fs from 'fs';
const { fetchLive } = createRequire(import.meta.url)('../lib/flipp.js');
const d = await fetchLive(); fs.writeFileSync(new URL('../data/deals.json', import.meta.url), JSON.stringify(d));
console.log(Object.entries(d.stores).map(([k, v]) => `${k}: ${v.status} ${v.count || ''}`).join('\n'));
// After a fresh snapshot, run: node scripts/resolve_units.mjs
