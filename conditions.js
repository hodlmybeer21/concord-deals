// Conditional / gated pricing. Every label comes from text Flipp shows for the item (pre/post price text, sale_story,
// description, disclaimer_text, original_price) or from a hand-checked override in data/condition_overrides.json.
// A regular (non-conditional) price is only ever a number the source states; it is never computed from typical pricing.
(function (root) {
  const n2 = x => Math.round(x * 100) / 100, $ = x => '$' + Number(x).toFixed(2), norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const num = s => { const v = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isFinite(v) && v > 0 ? v : null; };
  // detect(deal, info, override) -> cond object or null. info = Flipp item-detail fields.
  function detect(d, info, ov) {
    info = info || {};
    const pre = norm(info.pre_price_text || d.pre_price_text), pt = norm(info.price_text), post = norm(info.post_price_text);
    const story = norm(info.sale_story), desc = norm(info.description), disc = norm(info.disclaimer_text);
    const all = [pre, pt, post, story, desc, disc].join(' | ');
    const labels = [], fine = [disc, story].filter(Boolean).join(' · ') || null;
    let conditional = false, regular = null, regular_basis = null, n = null, must = false, kind = null;
    const price = d.price;
    // multi-buy: "2 for" / "3/" before the price, or a "2/$5.00" unit
    let m = pre.match(/^(\d+)\s*(?:for|\/)$/i) || String(d.unit || '').match(/^(\d+)\s*\/\s*\$/);
    if (m && +m[1] > 1) { n = +m[1]; kind = 'multi'; conditional = true; labels.push({ type: 'multi', text: `${n} for ${$(price)}` }); }
    // must buy N
    m = all.match(/when you buy\s+(\d+)(\s*or more)?/i) || all.match(/\bbuy\s+(\d+)\s+or more\b/i);
    if (m) { must = true; conditional = true; const k = +m[1];
      if (kind === 'multi') labels[labels.length - 1].text += ` · must buy ${k}`; else { n = n || null; kind = kind || 'must'; labels.push({ type: 'must', text: `Must buy ${k}${m[2] || /or more/i.test(m[0]) ? '+' : ''}${/participating/i.test(all) ? ' participating items' : ''}` }); } }
    const single = all.match(/single item price\s*\$?\s*(\d+(?:\.\d{1,2})?)/i);
    if (single) { regular = num(single[1]); regular_basis = `single-item price stated in the flyer: "${single[0]}"`; }
    // spend $X save $Y (chip only, never subtracted)
    m = all.match(/\$(\d+(?:\.\d\d)?)\s*off when you spend\s*\$(\d+(?:\.\d\d)?)/i);
    if (m) labels.push({ type: 'spend', text: `Spend $${m[2]} save $${m[1]}` });
    // digital coupon: the coupon sentence that belongs to a "spend $25" stock-up offer is not a price coupon
    const discNoStock = disc.split(/(?<=\.)\s+|\s*\*\s*/).filter(s => !/stock-up|spend/i.test(disc) || !/digital coupon|restrictions apply|stock-up|per transaction/i.test(s)).join(' ');
    let coupon = /digital coupon|\bfor u\b|clip/i.test([pre, pt, post, story, desc, discNoStock].join(' '));
    if (d.store === "Shaw's" && num(info.original_price) && num(info.original_price) > price) { coupon = true; if (regular == null) { regular = num(info.original_price); regular_basis = `price before the For U digital coupon (Flipp original_price ${$(regular)}; flyer tile shows SALE PRICE ${$(regular)} and the coupon)`; } }
    if (ov && ov.coupon) coupon = true;
    if (ov && ov.regular) { regular = ov.regular; regular_basis = ov.basis; }
    // Shaw's coupon tiles print "SALE PRICE X, -Y": with a coupon confirmed (override or badge read) and no original_price,
    // Flipp's dollars_off is that coupon amount, so the pre-coupon price is price + dollars_off (checked on Lucerne butter and Swanson broth tiles).
    if (ov && ov.coupon && regular == null && d.store === "Shaw's" && num(info.dollars_off)) { regular = n2(price + num(info.dollars_off)); regular_basis = `price before the For U coupon: flyer price ${$(price)} + Flipp dollars_off ${$(num(info.dollars_off))} (tile prints SALE PRICE and the coupon)`; }
    if (coupon) { conditional = true; labels.push({ type: 'coupon', text: d.store === "Shaw's" ? 'Digital coupon / For U' : 'Digital coupon' }); }
    // was-price (not Shaw's coupon tiles): label only; no rollback claim
    if (!coupon && num(info.original_price) && num(info.original_price) > price) labels.push({ type: 'was', text: `Was ${$(num(info.original_price))}` });
    m = all.match(/\blimit\s+(\d+)/i); if (m) labels.push({ type: 'limit', text: `Limit ${m[1]}` });
    if (/rebate|mail-in/i.test(all)) labels.push({ type: 'rebate', text: 'Rebate, not subtracted' });
    else if ((m = all.match(/\bearn\s+\$?(\d+(?:\.\d\d)?)/i))) labels.push({ type: 'rebate', text: `Earn $${m[1]} back, not subtracted` });
    if (/instant coupon/i.test(all)) labels.push({ type: 'instant', text: 'Instant coupon at register' });
    if (/\bpoints?\b/i.test(all) && /\d/.test((all.match(/[^|.]*points?[^|.]*/i) || [''])[0])) labels.push({ type: 'rebate', text: 'Bonus points, not subtracted' });
    // loyalty / member / card price: conditional; the regular price is only what the flyer states (original_price)
    if (!coupon && /my hannaford rewards|rewards members?|with (your )?(store )?card|card price|member price|members? only|loyalty/i.test(all)) {
      conditional = true; labels.push({ type: 'coupon', text: 'Member / card price' });
      if (regular == null && num(info.original_price) > price) { regular = num(info.original_price); regular_basis = `Flipp original_price ${$(regular)}`; } }
    if (/instant savings/i.test(all)) labels.push({ type: 'instant', text: 'Instant Savings (no clip)' });
    if (/\brollback\b/i.test(all)) labels.push({ type: 'was', text: 'Rollback (as stated)' });
    if (/\bclearance\b/i.test(all)) labels.push({ type: 'was', text: 'Clearance (as stated)' });
    if (/participating|restrictions apply/i.test(all) && !labels.some(l => l.type === 'must' || l.type === 'spend')) labels.push({ type: 'fine', text: 'Participating items only' });
    if (/not available (in|at)|select (stores|locations)|available only (in|at)/i.test(all)) labels.push({ type: 'fine', text: 'Select stores only' });
    if (d.store === "Sam's Club") labels.push({ type: 'member', text: 'Membership required' });
    if (!labels.length) return null;
    const each = kind === 'multi' && n ? n2(price / n) : null;
    if (regular != null && !(regular > (each || price))) { regular = null; regular_basis = null; } // a "regular" price not above the deal price is not trustworthy
    return { conditional, labels, regular, regular_basis, each, n, must, fine,
      basis: !conditional ? null : regular != null ? null : 'conditional price, regular price not listed' };
  }
  // view(deals, include): the deal list the app ranks and prices with.
  // include=false (default): conditional deals use their stated regular price, or are left out when none is listed.
  // include=true: conditional prices count; multi-buys use the per-item price.
  function view(deals, include) {
    const out = [], hidden = [];
    for (const d of deals) {
      const c = d.cond;
      if (!c || !c.conditional) { out.push(d); continue; }
      if (include) {
        if (c.each != null) out.push(Object.assign({}, d, { price: c.each, price_text: `${$(c.each)} ea`, unit: 'each', unit_min: c.n, _mode: 'cond' }));
        else out.push(Object.assign({}, d, { _mode: 'cond' }));
      } else if (c.regular != null) {
        out.push(Object.assign({}, d, { price: c.regular, price_text: $(c.regular), unit: c.each != null || /when you buy/i.test(d.unit || '') ? (String(d.unit || '').replace(/\s*\(when you buy[^)]*\)/i, '') || 'each') : d.unit, _mode: 'regular' }));
      } else hidden.push(d);
    }
    return { deals: out, hidden };
  }
  root.Cond = { detect, view };
  if (typeof module !== 'undefined') module.exports = root.Cond;
})(typeof window !== 'undefined' ? window : globalThis);
