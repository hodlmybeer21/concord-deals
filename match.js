(function (root) {
  const STOP = new Set(['the','a','of','and','or','with','oz','lb','lbs','ct','pk','pack','fl','select','varieties','assorted','fresh','each','or']);
  function stem(w) {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 4 && /(ches|shes|xes|oes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }
  function toks(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w) && !/^\d+$/.test(w)).map(stem); }
  // score: fraction of query tokens found in deal tokens (exact or prefix>=4)
  function score(q, d) {
    if (!q.length) return 0; let hit = 0;
    for (const t of q) if (d.some(x => x === t || (t.length >= 4 && (x.startsWith(t) || t.startsWith(x) && x.length >= 4)))) hit++;
    return hit / q.length;
  }
  function match(query, deals) {
    const q = toks(query); const byStore = {};
    for (const d of deals) {
      d._t = d._t || toks(d.item);
      const s = score(q, d._t); if (s < 1 && !(q.length > 2 && s >= 0.67)) continue;
      const cur = byStore[d.store];
      if (!cur || d.price < cur.price) byStore[d.store] = Object.assign({ score: s }, d);
    }
    const list = Object.values(byStore).sort((a, b) => a.price - b.price);
    return { query, byStore, best: list[0] || null };
  }
  root.DealMatch = { match, toks };
  if (typeof module !== 'undefined') module.exports = root.DealMatch;
})(typeof window !== 'undefined' ? window : globalThis);
