// Beer & Wine: classify flyer items, read pack sizes from Flipp item details, and build labels from the flyer's own wording.
// Never invents prices: per-unit prices are only derived when the flyer states both the count and the size.
(function (root) {
  const X = /\b(vinegar|cooking wine|root beer|ginger beer|birch beer|ginger ale|glass(es)?|stemless|tumblers?|opener|decanter|alka|seltzer water|sparkling water|beer cheese|beer brats?|beer[- ]battered|stella d'?oro|sauce|marinade|chicken|doughnuts?|donuts?|cocktail (sauce|shrimp|franks|weenies)|fruit cocktail|cranberry cocktail|juice cocktail|wine gums?|pepper|record player|body mists?)\b/i;
  const SUBS = [ // first match wins (mixed listings take the first category that appears in this order)
    ['Hard seltzer & RTD', /\b(hard seltzers?|white claw|truly|high noon|mike'?s hard|twisted tea|vodka (ade|tea|soda)|sun cruiser|surfside|smirnoff ice|hard lemonade|hard tea|bon ?& ?viv|vizzy|nütrl|nutrl|cutwater|happy dad|ready[- ]to[- ]drink)\b/i],
    ['Cider', /\b(hard ciders?|downeast( cider)?|angry orchard|citizen cider|stowe cider|bantam cider|woodchuck|austin eastciders)\b/i],
    ['Boxed wine', /\b(bota box|franzia|black box|boxed wine|wine box)\b/i],
    ['Wine', /\b(wines?|merlot|cabernet|chardonnay|pinot|sauvignon|riesling|rosé|ros[eé] wine|prosecco|champagne|moscato|malbec|zinfandel|sangria|barefoot|yellow tail|sutter home|josh cellars|kendall[- ]jackson|woodbridge|cupcake|apothic|la marca|19 crimes|bonterra|franciscan|bread & butter|cupcake|chateau ste)\b/i],
    ['Beer', /\b(beers?|ipa|lager|stout|pilsner|porter ale|ales?|budweiser|bud light|coors|miller lite|michelob|corona|modelo|heineken|sam adams|samuel adams|yuengling|blue moon|harpoon|guinness|dos equis|pacifico|natural light|busch|pabst|stella artois|athletic brewing|allagash|lagunitas|sierra nevada|founders|smuttynose|switchback|long trail)\b/i],
  ];
  const NA = /\b(non[- ]?alcoholic|alcohol[- ]free|athletic brewing|0\.0%?|n\/a beer)\b/i;
  function classify(name) {
    const n = String(name || ''); if (!n || X.test(n)) return null;
    for (const [sub, re] of SUBS) if (re.test(n)) { const all = NA.test(n) && !/,| or |•|&/.test(n);
      return { sub, na: all ? 'all' : NA.test(n) ? 'some' : false, kw: (sub === 'Hard seltzer & RTD' ? 'seltzer hard' : sub === 'Boxed wine' ? 'wine box' : sub.toLowerCase()) + (/samuel adams/i.test(n) ? ' sam' : '') }; }
    return null;
  }
  const num = s => parseFloat(String(s).replace(',', '.'));
  function parsePack(name, desc) {
    const t = `${name || ''} \n ${desc || ''}`;
    const cm = /(\d{1,2})\s*-?\s*(?:pack|pk)\b/i.exec(t) || /\b(\d{1,2})\s*(?:ct|count)\b/i.exec(t);
    const oz = /(\d+(?:\.\d+)?)\s*(?:fl\.?\s*)?oz\b/i.exec(t), ml = /(\d+(?:\.\d+)?)\s*ml\b/i.exec(t), l = /(\d+(?:\.\d+)?)\s*(?:ltr|liters?|litres?|l)\b\.?/i.exec(t);
    const size = oz ? { v: num(oz[1]), u: 'oz' } : ml ? { v: num(ml[1]), u: 'ml' } : l ? { v: num(l[1]), u: 'L' } : null;
    const cont = /\bcans?\b|aluminum/i.test(t) && /\bbottles?\b|btl/i.test(t) ? 'bottles or cans' : /\bcans?\b|aluminum/i.test(t) ? 'cans' : /\bbottles?\b|btl/i.test(t) ? 'bottles' : /\bbox\b|bota box|franzia|black box/i.test(t) ? 'box' : null;
    return { count: cm ? +cm[1] : null, size, container: cont };
  }
  const sizeTxt = s => s ? `${s.v} ${s.u}` : null;
  // ml per unit for wine equivalents
  const toMl = s => !s ? null : s.u === 'ml' ? s.v : s.u === 'L' ? s.v * 1000 : s.u === 'oz' ? s.v * 29.5735 : null;
  function describe(d, info) { // info: Flipp item detail {description, sale_story, disclaimer_text}
    const c = classify(d.item); if (!c) return null;
    const p = parsePack(d.item, info && info.description); const wine = c.sub === 'Wine' || c.sub === 'Boxed wine';
    let count = p.count; if (!count && d.unit && /^(\d{1,2}) ?-?pack\b/i.test(d.unit)) count = +/^(\d{1,2})/.exec(d.unit)[1]; // pack count read earlier from the flyer image (units.json, sourced)
    if (!count && wine && p.size) count = 1; // a single bottle/box when the flyer gives only the size
    let unit = null, per = null, flag = null;
    if (count && p.size) {
      unit = count > 1 ? `${count} × ${sizeTxt(p.size)}${p.container ? ' ' + p.container : ''}` : `${sizeTxt(p.size)} ${p.container === 'bottles' ? 'bottle' : p.container === 'cans' ? 'can' : p.container || (c.sub === 'Boxed wine' ? 'box' : 'bottle')}`;
      if (count > 1) per = { v: d.price / count, u: p.container === 'cans' ? 'can' : p.container === 'bottles' ? 'bottle' : 'each' };
      else if (wine && toMl(p.size) && Math.abs(toMl(p.size) - 750) > 1) per = { v: d.price / toMl(p.size) * 750, u: '750 ml' };
    } else flag = `pack size unconfirmed: flyer gives ${count ? count + '-pack, no container size' : p.size ? sizeTxt(p.size) + ' but no pack count' : 'no pack count or size'}`;
    if (per && d.price_text && /\d+\s*\/\s*\$/.test(d.price_text)) per = null; // multi-buy price ("2/$x"): don't divide
    const labels = []; const ss = info && info.sale_story && String(info.sale_story).trim(), dis = info && info.disclaimer_text && String(info.disclaimer_text).trim(), de = info && info.description || '';
    if (/select varieties/i.test(de) || /select varieties/i.test(d.item)) labels.push({ t: 'Select varieties', src: 'flyer' });
    if (/mix\s*(&|and|n)\s*match/i.test(`${d.item} ${de} ${ss || ''}`)) labels.push({ t: 'Mix & match', src: 'flyer' });
    else if (/,| or |•/.test(d.item)) labels.push({ t: 'Price applies to any brand listed', src: 'nhcart' });
    if (ss) labels.push({ t: ss, src: 'flyer' });
    if (ss && /rebate/i.test(ss)) labels.push({ t: 'Rebate not subtracted from the price shown', src: 'nhcart' });
    if (ss && /final cost/i.test(ss)) labels.push({ t: 'Price shown is the final cost after the instant coupon (per flyer)', src: 'nhcart' });
    else if (ss && /instant coupon/i.test(ss)) labels.push({ t: 'Check the flyer for whether the price includes the coupon', src: 'nhcart' });
    if (dis) for (const line of dis.split(/\n+/)) if (line.trim()) labels.push({ t: line.trim(), src: 'flyer' });
    if (c.na === 'some') labels.push({ t: 'Listing includes a non-alcoholic option', src: 'nhcart' });
    return { sub: c.sub, na: c.na, kw: c.kw, count: count || null, size: sizeTxt(p.size), container: p.container, unit, per, flag, labels };
  }
  root.Alcohol = { classify, parsePack, describe };
  if (typeof module !== 'undefined') module.exports = root.Alcohol;
})(typeof window !== 'undefined' ? window : globalThis);
