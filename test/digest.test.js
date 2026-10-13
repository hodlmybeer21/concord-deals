const test = require('node:test'), assert = require('node:assert');
const { buildDigest, FRESH_MS } = require('../lib/digest');
const E = require('../lib/email');
const snap = () => JSON.parse(JSON.stringify(require('../data/deals.json')));
const names = d => d.stores.filter(s => s.available).map(s => s.store).sort();

test('freshness window is 36h', () => assert.equal(FRESH_MS, 36 * 36e5));
test('Sunday send (Oct 11 cycle): every flyer good past the 36h cutoff is included', async () => {
  const d = await buildDigest(snap(), { now: '2026-10-11T15:18:00Z' });
  assert.equal(d.midweek, false); assert.ok(names(d).includes('Aldi')); assert.ok(names(d).includes('Market Basket')); assert.equal(d.skipped.length, 0); });
test('expiry: flyers ending within 36h of the send are dropped, with a reason', async () => {
  const d = await buildDigest(snap(), { now: '2026-10-13T15:18:00Z' }); // Tue: Aldi/Walmart end Tue 13
  assert.ok(!names(d).includes('Aldi')); assert.ok(!names(d).includes('Walmart'));
  assert.ok(d.skipped.some(s => s.store === 'Aldi' && /within a day/.test(s.reason)));
  for (const s of d.stores) for (const x of s.deals) assert.ok(new Date(x.valid_to) >= new Date(d.cutoff), `${x.item} expires before cutoff`); });
test('expiry: a single deal that ends within 36h is excluded from deals and meal pricing', async () => {
  const data = snap(); const t = data.deals.find(x => x.store === 'Shaw\'s' && /broccoli/i.test(x.item)); assert.ok(t);
  const before = await buildDigest(snap(), { now: '2026-10-11T15:18:00Z' });
  t.valid_to = '2026-10-12T12:00:00Z'; const after = await buildDigest(data, { now: '2026-10-11T15:18:00Z' });
  const has = d => d.stores.some(s => s.deals.some(x => x.item === t.item));
  assert.ok(has(before)); assert.ok(!has(after));
  const b = before.meals.find(m => /Broccoli/.test(m.name)), a = after.meals.find(m => m.name === b.name);
  assert.ok(!a || a.total !== b.total || a.partial || a.stores !== b.stores, 'meal price must not use the expired deal'); });
test('all flyers expired: digest is empty and has no meals', async () => {
  const d = await buildDigest(snap(), { now: '2026-10-18T15:18:00Z' }); assert.equal(d.empty, true); assert.equal(d.meals.length, 0); assert.equal(d.skipped.length, 6);
  const m = E.digestEmail(d, 'https://nhcart.goodbotai.tech/u'); assert.ok(m && /Not included/.test(m.html)); });
test('Wednesday send never repeats stores whose flyer started before Sunday', async () => {
  const d = await buildDigest(snap(), { now: '2026-10-14T15:18:00Z' }); assert.equal(d.midweek, true);
  for (const s of ['Market Basket', 'Hannaford', 'Shaw\'s']) { assert.ok(!names(d).includes(s)); assert.ok(d.skipped.some(x => x.store === s && /Sunday/.test(x.reason))); } });
test('all email links use nhcart.goodbotai.tech', async () => {
  const d = await buildDigest(snap(), { now: '2026-10-11T15:18:00Z' }); const m = E.digestEmail(d, `${E.SITE}/api/unsubscribe?token=x`);
  assert.equal(E.SITE, 'https://nhcart.goodbotai.tech'); assert.ok(!/vercel\.app/.test(m.html + m.text));
  for (const u of (m.html.match(/href="([^"]+)"/g) || [])) assert.match(u, /nhcart\.goodbotai\.tech|flipp\.com|mailto:/); });
