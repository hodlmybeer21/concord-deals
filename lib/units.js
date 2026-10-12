// Resolve per-lb vs each ONLY from text a source explicitly shows (Flipp item detail fields).
// Never infer from typical pricing. Returns {unit, unit_source_field, unit_text} or null.
function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
const PKG = /\b(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)[\s-]*(oz|fl\.? ?oz|lb|lbs|ct|count|pk|pack|qt|gal|l|ml|g|kg)\.?\s*(pkg|package|bag|box|container|jar|can|bottle|tray|carton|bunch)\b/i;
function resolveUnit(d) {
  const pre = norm(d.pre_price_text), pt = norm(d.price_text || d.post_price_text), desc = norm(d.description), story = norm(d.sale_story);
  // 1) explicit price-adjacent text (strongest)
  if (/^(\/\s*)?(per\s+)?lbs?\.?$/i.test(pt) || /^\/?lb\.?\b/i.test(pt)) return { unit: 'lb', field: 'price_text', text: pt };
  if (/^(\/\s*)?(per\s+)?(ea|each)\.?$/i.test(pt)) return { unit: 'each', field: 'price_text', text: pt };
  if (/^\d+\s*for$/i.test(pre)) return { unit: `${pre.match(/\d+/)[0]}/$${Number(d.current_price || d.price).toFixed(2)}`, field: 'pre_price_text', text: pre };
  if (/^\d+\s*\/$/.test(pre)) return { unit: `${pre.replace(/\s/g, '')}$${Number(d.current_price || d.price).toFixed(2)}`, field: 'pre_price_text', text: pre, qty: pre };
  if (pt && /\b(oz|ct|pk|pkg|qt|gal)\b/i.test(pt)) return { unit: pt.toLowerCase(), field: 'price_text', text: pt };
  // 2) explicit per-unit phrase in description/sale story
  for (const [f, s] of [['description', desc], ['sale_story', story]]) {
    if (/\b(per|\/)\s*lb\b|\blb\.?\s*$/i.test(s) && !/\d\s*lb/i.test(s.match(/(per|\/)\s*lb|lb\.?\s*$/i)?.input?.slice(0,0) || '')) {
      if (/\b(per|\/)\s*lb\b/i.test(s)) return { unit: 'lb', field: f, text: s };
    }
    if (/\b(per|\/)\s*(ea|each)\b|\beach\b/i.test(s) && /\b(per|\/)\s*(ea|each)\b|^each\b/i.test(s)) return { unit: 'each', field: f, text: s };
    const m = s.match(PKG);
    if (m) return { unit: `${m[1]} ${m[2].toLowerCase()} ${m[3].toLowerCase()}`.replace(/\.$/, ''), field: f, text: s };
  }
  // 3) explicit "EA." in sale story (e.g. "SAVE 73¢ EA.")
  if (/\b(ea|each)\.?\s*$/i.test(story) && /save/i.test(story)) return { unit: 'each', field: 'sale_story', text: story };
  // 4) package size stated as the first token of the description (e.g. "32 Oz.", "10-11.5 oz., select varieties") => priced per package of that size
  const m2 = desc.match(/^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(fl\.?\s*oz|oz|ct|count|pk|qt|gal|ml|l|lb|lbs)\.?(?=[\s,]|$)/i);
  if (m2) return { unit: `${m2[1].replace(/\s/g,'')} ${m2[2].toLowerCase().replace(/\.\s*/,' ')} pkg`, field: 'description', text: desc };
  return null;
}
module.exports = { resolveUnit };
