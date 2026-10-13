// Weekly price snapshots for future price history. Stores exactly what the flyer said (no derived or invented prices),
// with source_url and fetched_at on every row. File: data/history/YYYY-MM-DD.json (date in America/New_York).
const fs = require('fs'), path = require('path');
const dayET = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
function historyRows(data) {
  return data.deals.filter(d => d.source !== 'web' || d.source_url).map(d => ({ store: d.store, item: d.item, price: d.price, price_text: d.price_text,
    unit: d.unit || null, unit_flag: d.flag || null, flipp_item_id: d.flipp_item_id || null, valid_from: d.valid_from || null, valid_to: d.valid_to || null,
    source: d.source || 'flyer', source_url: d.source_url, fetched_at: d.fetched_at || data.fetched_at }));
}
function writeHistory(data, dir = path.join(__dirname, '..', 'data', 'history')) {
  fs.mkdirSync(dir, { recursive: true }); const file = path.join(dir, dayET(data.fetched_at) + '.json');
  const stores = {}; for (const [k, v] of Object.entries(data.stores)) stores[k] = { status: v.status, flyer_id: v.flyer_id || null, valid_from: v.valid_from || null, valid_to: v.valid_to || null, source_url: v.source_url || null };
  fs.writeFileSync(file, JSON.stringify({ fetched_at: data.fetched_at, stores, rows: historyRows(data) }));
  return file;
}
module.exports = { writeHistory, historyRows, dayET };
