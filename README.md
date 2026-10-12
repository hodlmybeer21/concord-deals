# Concord NH Flyer Deals (prototype)

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
