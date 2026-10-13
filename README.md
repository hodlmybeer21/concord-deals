# NH Cart (formerly Concord Deals)

New Hampshire grocery deals, meals and a store-by-store trip list. **Flyers are currently sourced for the Concord, NH area (03301)**; prices can differ at other NH locations. Repo, Vercel project and domain keep the `concord-deals` name.

Mobile-first demo: paste a shopping list and see the cheapest store this week for each item, using the current weekly flyers for **Market Basket**, **Hannaford**, **Aldi**, **Shaw's**, **Sam's Club**, and **Walmart** in Concord, NH (03301).

## How it works
- `api/deals.js` is a Vercel Node function. It fetches the current flyers live, normalizes them to `{item, price, price_text, unit, store, valid_from, valid_to, source_url}`, and caches the result with `s-maxage=3600`.
- `data/deals.json` is a committed snapshot of real scraped data (`npm run snapshot`). The API uses it only when a live fetch fails and the snapshot is still within its sale dates.
- `index.html` + `match.js` do the fuzzy matching (token overlap, plurals). The list is saved in localStorage.
- **Prices are never invented.** If a store's flyer can't be fetched or parsed, the UI marks that store as *unavailable*.

## Data source: Flipp (unofficial)
`https://backflipp.wishabi.com/flipp/flyers?postal_code=03301` and `/flipp/flyers/{id}`. This is an undocumented public endpoint with no API agreement, so it carries ToS risk and is **for demo use only**. Flyers are picked by merchant name and current valid dates, not by hardcoded IDs. "Market Basket" and "Demoulas Market Basket" are deduped. When a store has several current flyers (e.g. Shaw's Weekly Ad vs Big Book of Savings), the shortest-window weekly ad wins. Stores with no sourceable flyer show as unavailable with a reason; prices are never estimated. Flyer prices can be per-lb or per-each, and the feed often omits the unit, so check the flyer.

## Planned fallback: vision extraction
The plan is to run a vision model on the flyer page images (`f.wishabi.net/flyers/{id}/…jpg`, or the stores' own web/PDF flyers) to pull item, price/unit, and dates from image-heavy layouts. This is **not wired up yet** because no model API key is configured.

## Next stores
Costco.

## Custom domain
To serve this at `deals.goodbotai.tech`, add a Hostinger DNS CNAME `deals` -> `cname.vercel-dns.com`, then add the domain to the Vercel project.

## Price sources and verification
Every price carries `source` (`flyer` or `web`), `source_url`, and `fetched_at`; the UI shows a [flyer]/[web] tag, the fetch time, and a source link.
Flyer items whose unit is not stated are flagged ⚠️ (per-lb vs each unclear) instead of shown as clean prices.

Web pricing status (Oct 12, 2026):
- **Walmart**: blocked by site (PerimeterX captcha on first plain request). Flyer used.
- **Sam's Club**: blocked by site (PerimeterX captcha after 2 slow requests). Flyer used. `scripts/web_samsclub.mjs` prices a ~40-item basket slowly and stops on any challenge; it is not run in production.
- **Aldi / Shaw's**: own sites are client-rendered/store-scoped; flyer used.
We do not use proxies, header spoofing, or browser automation to get around bot protection. Getting web prices would need an official API/affiliate feed (e.g. Walmart Affiliate API key) or the user's OK for a browser-based pass.

## Meals tab (branch `meals`)
- `data/recipes.json`: 43 hand-written recipes (serves 4) built around this week's deals. Each ingredient has `q` (deal search terms), optional `not` (excluded words) and `est` (estimate key). Pantry staples are listed, never priced.
- `meals.js`: strict matching (every query word must appear as a whole word, so "eggs" never matches "eggplant"; prepared foods are blocked). Only deals with a confirmed unit are used. Per-lb deals cost price × lb; package, each and multi-buy deals are counted whole (multi-buy = the whole N/$X rule), with the share used shown. Picks the cheapest store per ingredient, which mixes stores.
- No usable deal → regular-price **estimate** from `data/price_estimates.json` (BLS Average Price Data, APU series, U.S. city average; series id, period and source URL stored). No estimate → "price unknown", left out of the total, and the total is marked partial. Estimates never count as savings; the flyers carry no regular prices, so no savings figure is shown.
- `node scripts/meals_report.mjs v` prints every recipe's pricing.

## Trip tab (branch `shopping-trip`)
Store-by-store checklist: every list item goes under the store with its cheapest confirmed-unit deal, in pick order (produce, bakery, deli, meat & seafood, pantry, household, other, then dairy and frozen). Merges recipe ingredients (quantities combined, "for:" recipes note) with deals pinned via "+ add to list" (pinned to that deal and store). Sale / est. regular (BLS, cited) / price unknown tags; per-store and trip totals (partial when an item has no price or quantity); have-it/skip; in-store mode; "Anywhere: no flyer deal" section; one store vs split; clear checked; copy as text; print stylesheet. State lives in localStorage (`cd_meta`, `cd_pins`, `cd_trip_done`, `cd_trip_owned`, `cd_instore`).

## PWA (branch `pwa`)
Installable: `manifest.webmanifest`, icons in `/icons` (192, 512, maskable 512, apple-touch 180). `/sw.js` is served by `api/sw.js` (rewrite in `vercel.json`) with the deploy's commit sha as the cache version, so each deploy installs a new shell cache, deletes old ones, and shows "New deals available, tap to refresh". App shell + recipes/estimates are precached; `/api/deals` is network-first with a cached fallback marked `X-CD-Cache: offline`, which shows an "Offline, showing deals fetched …" banner (and says when flyers have expired). Lists, meal selections and trip check state are in localStorage, so they work offline.

## Analytics (branch `analytics`)
🔒 Privacy: no cookies, aggregate analytics only (Vercel Web Analytics). Lists, meal selections and trip state never leave the device; events carry only a name and small non-personal properties.
Script: `/_vercel/insights/script.js` with the `window.va` queue (the service worker never caches or intercepts `/_vercel/*`). Events: `tab_view {tab}`, `add_to_list {source: manual|deal|meal, count}`, `meal_opened {meal}` (recipe name), `meal_added {count}`, `install_app {platform: android|ios}`, `offline_view`, `print_trip`. Custom events require Vercel Pro (2 properties per event, all ours fit); on Hobby only page views are collected (50,000 events/month, 1-month reporting window) and the calls are harmless no-ops. Enable in Vercel → Project → Analytics → Enable, then redeploy.

## Review overhaul (deals UX)
- **Cards:** price and unit first, then store, then product, with a Flipp thumbnail (`image_url` from Flipp item `cutout_image_url`, https, lazy-loaded, "no image" fallback). Each price shows a FLYER/WEB tag, expiry pill, flyer dates, fetched time (ET), a source link and a "Report wrong price" mailto to nhcart@mail.grokbot.com prefilled with item, store, price, source_url and fetched_at. Unconfirmed units are flagged "⚠️ unit?".
- **Source links:** `https://flipp.com/en-us/flyer/<id>?postal_code=03301` (checked in headed Chromium; item-level Flipp URLs never showed the item). Snapshot links are rewritten to the same form at runtime.
- **Best this week:** the cheapest confirmed-unit flyer deal for ~50 staple items, ranked by how many stores carry a matching deal. Strict whole-word matching within the same category. No savings figures. Category filter chips.
- **Watch (favorites):** ☆ Watch on any item, saved in localStorage. The Watching card highlights the ones on sale this week. There are no push or email alerts yet.
- **Share list / family list:** the list and pins are encoded in a `#share=` link (no backend). The recipient chooses Replace, Add or Dismiss.
- **Paste a receipt or list:** extracts item names only and drops prices, totals, payment and store lines, then matches them against this week's deals.
- **Related deals** on each item, collapsed "no flyer deal at …" rows, empty-state suggestions, chip scroll hint, 2-column desktop at ≥1000px, WCAG AA contrast, 7-step type scale (12–28px).
- **Weekly email signup** sits after the Trip total. It stays inert ("Coming soon") unless `GET /api/subscribe?status=1` returns `{open:true}`. Nothing on main implements that yet.
- **Price history:** run `node scripts/snapshot.mjs --history-only` from the repo root. It fetches the live Flipp flyers and writes `data/history/YYYY-MM-DD.json` (date in ET; raw flyer rows with price, price_text, unit or flag, valid dates, source_url and fetched_at). It doesn't touch `data/deals.json`. Commit only `data/history/`. The Sun/Wed refresh routine runs this as hodlmybeer21. `npm run snapshot` (no flag) also refreshes the `data/deals.json` fallback snapshot; after that, run `node scripts/resolve_units.mjs`.
- **Matching:** `match.js` uses whole-word matching and skips compound products (e.g. "butter" does not match peanut butter, butternut squash, apple butter or buttermilk; "chicken" does not match chicken broth; "cream" does not match ice cream or cream cheese; "corn" does not match popcorn or corn flakes). It also skips appliances and cosmetics. A query that names the compound ("peanut butter") still matches it.
