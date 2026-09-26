# Callina 🐱

A Chrome extension that finds foreign-currency prices on any web page and shows, right next to them,
what they cost in **your** currency (Sri Lankan Rupees by default) and in **hours of your work**.
A judgmental cartoon cat reacts to how expensive things are.

```
$49.99 [≈ Rs 16,492 · 🐾 2.4 h]
```

No accounts, no backend, no analytics, no build step.

## Install

1. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and choose this `callina/` folder.
4. Optional: to try the test page (`tests/fixtures/prices.html`) from disk, open the extension's
   **Details** and turn on **Allow access to file URLs**.

## Features

- **Price detection**:
  - Symbols: `$ € £ ¥ ₹ ₩ ₽ ₺ ₫ ฿ ₱ R$ A$ C$ CA$ S$ HK$ NZ$ US$ Rs Rs. RM kr zł Fr. CHF 円 …`
  - ISO codes: `USD 49`, `49 USD`, `EUR49`. About 40 currencies are covered.
  - Number formats: `1,234.56`, `1.234,56`, `1 234,56` (including no-break spaces), `$1.2k`, `£5m`, `$2 billion`.
  - Ranges: `$10 – $20` (two badges) and `$10–20` (one badge showing the range).
  - Split prices, such as Amazon's `<span>$</span><span>49</span><span>.99</span>` and `$49<sup>99</sup>`.
- **Ambiguous symbols** (`$`, `¥`, `kr`, `Rs`) are resolved in this order:
  1. An explicit prefix (`US$`, `C$`, `CN¥`, …).
  2. The page's structured data (`priceCurrency` microdata or JSON-LD, `product:price:currency`).
  3. Your per-site `$` setting in the popup.
  4. The site's domain (`.ca` → CAD, `.com.au` → AUD, `.cn` → CNY, `.lk` → LKR, …).
  5. Defaults: `$` → USD, `¥` → JPY, `Rs` → LKR if your home currency is LKR, otherwise INR.
- **Work hours**:
  - Enter your monthly income, hours per day and days per month. Each badge then shows how long you'd work for that price: `35 min`, `2.4 h`, `3.5 days`, `1.2 months`.
  - Invalid or empty income hides the work time everywhere.
- **Hover tooltip** shows:
  - The original amount and currency.
  - A more precise conversion.
  - The rate used and its date.
  - The work time in words ("≈ 2 hours 24 minutes of work").
  - A cat whose identity, face and one-liner depend on how affordable the price is (see **Price moods** below).
- **Price moods.** Every price falls into one of six affordability moods. Each mood has its own cat (you can pick them in Options), its own expression, and a set of funny lines shown in a speech bubble:

  | Mood | Work time (with income set) | Price only (no income) | Face | Default cat | Example line |
  |---|---|---|---|---|---|
  | Pocket change | under 15 min | under $5 | heart eyes | Vibe | “Purr-fect price!” |
  | Treat yourself | 15 min – 1 h | $5–25 | happy | Pop | “Meow-velous deal!” |
  | Fair enough | 1 h – 1 workday | $25–100 | calm | Loaf | “Not bad, human.” |
  | Hmm, pricey | 1 – 5 workdays | $100–500 | worried (sweat drop) | Huh? | “My whiskers are sweating.” |
  | Ouch | 5 workdays – 1 work month | $500–2,500 | shocked | Screamer | “HOW MUCH?!” |
  | Absolutely not | a work month or more | over $2,500 | faints | Banana | “This cat has left the chat.” |

  Workdays and work months follow your own hours/day and days/month. Price-only limits are converted into your home currency on the Options page.
  You can also choose “Always my mascot”, which keeps one cat and only changes its face.
- **Twelve original cats**, drawn as hand-written SVG with CSS animations:
  - Classic: Loaf, Judge, Derp, Screamer, Keyboard Paws and Void.
  - Meme cats: Pop, Monday, Vibe, Sad Thumbs, Huh? and Banana. Each riffs on a famous internet cat-meme format with original art.
  - Or upload up to 6 of your own PNG/JPG/GIF/WebP images (up to 1 MB each), for example your favourite meme GIFs. Uploads get a generic bounce/shake.
  - The toolbar icon follows the selected cat.
- **Popup**:
  - On/off switch, disable on this site, and a per-site `$` override (shown when the page has `$` prices).
  - A count of converted prices, and rate freshness with a refresh button.
  - Quick income settings.
- **Options page**:
  - Home currency, searchable (any currency the rate source supports).
  - Work settings, with an "your time is worth ≈ Rs 1,250 / hour" preview.
  - Display: work hours on/off, whole numbers or 2 decimals, subtle or bold badge.
  - Mascot picker (classic, meme and uploaded cats) with reaction previews, and the upload area.
  - Price moods: the six ranges (in your work time and currency), a cat per mood, sample lines.
  - List of disabled sites.
- **Live updates**: settings changes apply to open tabs instantly, with no reload.
- `prefers-reduced-motion` freezes every cat in a static pose.

## Exchange rates

The rate sources were verified to include LKR and to need no API key. The service worker tries them in order:

1. [`fawazahmed0/exchange-api`](https://github.com/fawazahmed0/exchange-api) via jsDelivr
   (`cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json`)
2. The same data from its Cloudflare Pages mirror (`latest.currency-api.pages.dev`)
3. [ExchangeRate-API open access](https://www.exchangerate-api.com/docs/free) (`open.er-api.com/v6/latest/USD`)

How rates are fetched and cached:
- **One USD-based table.** Any pair is cross-converted (`rate(A→B) = usd[B] / usd[A]`), so changing your home currency or income currency never needs a new request.
- **Cached for 12 h** in `chrome.storage.local`. Cached rates are served immediately and refreshed in the background when stale.
- **If every source fails,** the last cached rates keep working and the popup shows "Offline · rates from <date>".
- **Content scripts never fetch.** They ask the service worker for rates.

## Privacy

**No data leaves your browser except a request for exchange rates.** In detail:
- The extension downloads a public rate table. The request contains nothing about you or the pages you visit.
- Settings live in `chrome.storage.sync`. Your uploaded images and the rate cache live in `chrome.storage.local`.
  Each upload is stored under its own key (`customCat:<id>`), so web pages only read the one you selected.
- Nothing is sent anywhere else. There are no analytics and no remote code.

Permissions:
- `storage`
- Host access to the three rate domains only.
- A content script on all pages, which is needed to find prices.

## Tests

```
node --test tests/          # or: npm test
```

- `tests/parser.test.js` covers:
  - every number format and symbol/ISO position
  - ranges and magnitudes
  - non-prices (dates, phone numbers, versions, percentages)
  - all five ambiguity rules
- `tests/convert.test.js` covers:
  - cross rates
  - income validation and hourly-rate math
  - the four work-time thresholds and wording
  - money formatting and badge text
  - the six affordability moods (by work time and by price), their range texts and phrases
- `tests/fixtures/prices.html` is a manual test page with 66 cases:
  - 48 price rows, including split spans, Amazon markup and ranges
  - 2 dynamic rows (a price added later, and a price whose text changes)
  - 16 must-not-convert rows (dates, phone numbers, versions, percentages, inputs, textarea, code, contenteditable, SVG text, home-currency prices)
  - After loading, each row turns green or red and a summary shows at the top. Home currency must be LKR.

## Tested on

Tested on 2026-09-26 in Chrome for Testing 154 with the unpacked extension:

| Site | Result |
|---|---|
| Fixtures page | 66/66 pass |
| 3,000-product synthetic Amazon-style page | 6,000 badges in < 1 s, no long tasks (> 50 ms) while scanning or scrolling |
| en.wikipedia.org (List of most expensive paintings) | 410 prices, incl. `US$100 million`, `£24.75 million` |
| amazon.com search | every result price badged once (split-price markup, screen-reader copy skipped) |
| ebay.com search | works (`$45.00`, `Under $45.00`, `$20.00 to $80.00`) |
| aliexpress.com search | works, including ranges |
| theguardian.com | works (`£210m`, `£21bn`, `$1bn`) |
| booking.com | no prices until dates are chosen; from Sri Lanka it already shows LKR (nothing to convert) |

## Known issues and limitations

- **Sites that already show your home currency.** Amazon, Booking and others geolocate you. From Sri Lanka they often show LKR already, which is correctly left alone.
- **Prices split across unrelated elements.** For example `Total: <span>$</span><span>10</span>` inside a longer sentence isn't joined, because the combined text isn't *exactly* one price. Tight price wrappers (Amazon, eBay, most shops) are fine.
- **Prices not reachable as DOM text are not detected:**
  - prices in images, `<canvas>` or cross-origin iframes (content scripts run in the top frame only)
  - prices inside other sites' shadow DOM (web components)
- **Wrong domain guesses for `$`.** A `$` on a `.ca` site is read as CAD unless the page's metadata says otherwise. If a site's `$` really means something else, pick it in the popup.
- **Space as thousands separator.** `$5 100` is read as $5,100, which is the conventional meaning in many locales but can be wrong for text like "3 100 USD" meaning "3 × 100 USD".
- **`PHP` below 10 is ignored**, so "PHP 8.2" (the language) isn't read as pesos.
- **Toolbar icon.**
  - It updates when you open the popup or options page after changing the mascot on another synced device.
  - It isn't animated. The optional "wiggle" was skipped as unreliable.
- **No real meme images are bundled.** Famous meme photos and art are copyrighted (and some, like Grumpy Cat, are
  trademarked), which gets extensions removed from the Chrome Web Store. The meme cats are original drawings.
  Real memes can be added by each user through the upload feature, for personal use.
- **Custom mascot and strict CSP.** On pages with a very strict CSP, the custom image may not load in the tooltip. The tooltip then falls back to Loaf.
