// Renders sample emails/pages to a folder (default /tmp/em) from current data. Sends nothing.
const fs = require('fs'), E = require('../lib/email'), { buildDigest } = require('../lib/digest');
(async () => { const out = process.argv[2] || '/tmp/em'; fs.mkdirSync(out, { recursive: true });
  const env = { MAIL_FROM: 'deals@nhcart.goodbotai.tech' };
  const d = await buildDigest(); const dg = E.digestEmail(d, `${E.SITE}/api/unsubscribe?token=SAMPLE`, env);
  const cf = E.confirmEmail('you@example.com', `${E.SITE}/api/confirm?token=SAMPLE`, env);
  fs.writeFileSync(out + '/digest.html', dg.html); fs.writeFileSync(out + '/digest.txt', dg.subject + '\n\n' + dg.text);
  fs.writeFileSync(out + '/confirm.html', cf.html); fs.writeFileSync(out + '/confirm.txt', cf.subject + '\n\n' + cf.text);
  fs.writeFileSync(out + '/confirmed.html', E.page('You’re subscribed', '<p><b>you@example.com</b> will get the NH Cart weekly email: the best flyer deals and the cheapest meals, twice a week at most.</p><p>Every email has a one-click unsubscribe link.</p>'));
  fs.writeFileSync(out + '/unsubscribed.html', E.page('You’re unsubscribed', '<p><b>you@example.com</b> won’t get any more NH Cart emails.</p><p>Changed your mind? You can sign up again on the site any time.</p>'));
  console.log(dg.subject); console.log(JSON.stringify(d.stores.map(s => [s.store, s.deals.length]))); console.log(d.meals.map(m => m.name + ' ' + m.total).join(' | '));
})();
