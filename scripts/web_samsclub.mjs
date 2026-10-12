// Prices a small cached basket from samsclub.com search pages (public, no login).
// Slow (4s between requests), stops on any bot challenge. Never estimates prices.
import fs from 'fs';
const BASKET = ['milk','eggs','bread','bananas','chicken breast','ground beef','butter','cheddar cheese','yogurt','apples','potatoes','onions','carrots','lettuce','tomatoes','rice','pasta','pasta sauce','cereal','oatmeal','coffee','orange juice','peanut butter','jelly','flour','sugar','olive oil','bacon','sausage','hot dogs','salmon','frozen vegetables','paper towels','toilet paper','strawberries','grapes','avocados','tortillas','cream cheese','sliced turkey'];
const out = { store: "Sam's Club", source: 'web', fetched_at: new Date().toISOString(), note: 'samsclub.com online price; club not pinned (not set to a specific NH club)', items: [], unpriced: [], blocked: null };
function walk(o, acc) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(x => walk(x, acc)); return; }
  if (typeof o.name === 'string' && typeof o.price === 'number' && o.price > 0 && o.canonicalUrl) acc.push(o); for (const v of Object.values(o)) walk(v, acc); }
for (const q of BASKET) {
  const url = `https://www.samsclub.com/search?q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { redirect: 'follow' }); const h = await r.text();
  if (r.status >= 400 || /\/blocked\?|are-you-human|px-captcha|Robot or human/i.test(r.url) || /px-captcha/i.test(h) && !/__NEXT_DATA__/.test(h)) { out.blocked = `blocked by site at "${q}" (HTTP ${r.status})`; break; }
  const m = h.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); const acc = [];
  if (m) walk(JSON.parse(m[1]), acc);
  const seen = new Set(); const picks = acc.filter(p => !p.isSponsoredFlag && !seen.has(p.name) && seen.add(p.name)).slice(0, 3);
  if (!picks.length) out.unpriced.push({ query: q, reason: 'no priced results parsed' });
  for (const p of picks) out.items.push({ item: p.name.trim(), price: p.price, price_text: `$${p.price.toFixed(2)}`, unit: (p.salesUnit || '').toLowerCase() || null,
    store: "Sam's Club", source: 'web', query: q, source_url: 'https://www.samsclub.com' + p.canonicalUrl, valid_from: out.fetched_at, valid_to: null });
  console.log(q, picks.length); await new Promise(r => setTimeout(r, 4000));
}
fs.writeFileSync(new URL('../data/web_samsclub.json', import.meta.url), JSON.stringify(out));
console.log('items', out.items.length, 'blocked', out.blocked);
