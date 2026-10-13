// Dry-run: render the digest as if sent at a given time. Sends nothing. Usage: node scripts/render_digest_at.js <ISO time> <out.html> [snapshot]
const fs = require('fs'), E = require('../lib/email'), { buildDigest, getDeals } = require('../lib/digest');
(async () => { const [at, out, snap] = process.argv.slice(2);
  const data = snap ? await getDeals() : null; const d = await buildDigest(data, { now: at });
  const m = E.digestEmail(d, `${E.SITE}/api/unsubscribe?token=SAMPLE`, { MAIL_FROM: 'deals@nhcart.goodbotai.tech' });
  fs.writeFileSync(out, m.html); fs.writeFileSync(out.replace(/\.html$/, '.txt'), m.subject + '\n\n' + m.text); console.log(m.subject); })();
