---
inclusion: manual
---

# DesiChowrastha Admin Panel: project context

Reconstructed from the commit history (230 commits as of 2026-11-21), the READMEs, and the server layout. Anything marked TODO needs the owner to fill in.

## What it is
A restaurant management system for DesiChowrastha. React client (`client/`) and Node/Express server (`server/`). Firebase handles auth, Firestore data, and Storage for receipt images. Ant Design is the UI library.

## Locations
- Westborough (MA) and Nashua (NH) are the main locations. Herndon (VA) also has Toast credentials configured.
- Recipient phone lists (owner, manager, chef, purchaser) are set per location, with a global fallback. The logic is in `server/services/recipients.js`.
- Restaurant addresses on invoices are chosen by location (a past bug showed the Nashua address for every location).
- `server/services/resolveRestaurantId.js` maps a request to a location.

## Integrations
- **Toast (POS):** Per-location client ID, secret, and external restaurant ID. Webhooks arrive at `/api/orders/webhook` and `/api/stock/webhook`. Toast sometimes sends an epoch-sentinel date for "unset"; treat it as no date.
- **WhatsApp Business API:** Per-location phone number IDs and message templates (feedback, out-of-stock, today's and tomorrow's special, stock order, party order invoice, party order prep sheet).
- **OpenAI (GPT-4o):** Receipt scanning, menu item detail generation, and the menu "ask" chat.
- **Google Sheets:** Cash and payroll syncs (`googleSheetsService.js`, `otherCashSync.js`, `salaryCashSync.js`, `toastCashService.js`).
- **Facebook page and Unsplash:** Used for posting and images (see `todaysSpecialImage.js`).
- **Azure Static Web Apps:** Hosts the front end through a GitHub Actions workflow (see `.github/`). TODO: record where the server runs and how it is deployed (there is a `server/.deployment` file and a root `web.config`).

## Environment variables (names only; values live in `server/.env`, which is not tracked)
Toast: `TOAST_API_BASE_URL`, `TOAST_WEBHOOK_SECRET`, and per location `*_CLIENT_ID`, `*_CLIENT_SECRET`, `*_RESTAURANT_EXTERNAL_ID` for `WESTBOROUGH`, `NASHUA`, `HERNDON`.
WhatsApp: `WA_ACCESS_TOKEN`, `WA_PHONE_NUMBER_ID` (plus `_WESTBOROUGH`, `_NASHUA`), `WA_TEMPLATE_LANGUAGE`, and `WA_*_TEMPLATE_NAME` for each message type.
Recipients: `OWNER_`, `MANAGER_`, `CHEF_`, `PURCHASER_PHONE_NUMBER`, with `_NASHUA` and `_WESTBOROUGH` variants.
Other: `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `FB_ACCESS_TOKEN`, `FB_PAGE_ID`, `FB_API_VERSION`.
Firebase admin credentials come from `server/serviceAccountkey.json`, which is not tracked. Never commit it or `.env`.
TODO: say where the real values are backed up for the new PC (password manager, vault).

## Main features and how they work
- **Live Orders and Order Tracker:** Toast webhooks feed a lobby board over SSE (`/api/orders/stream`). It shows staged progress and elapsed time per order. Closed, paid, voided, and deleted orders must be excluded even if an item is still flagged SENT. Live Orders fetches the full business day on each poll (a delta merge left fulfilled orders on screen). Category filters accept repeated `?categories=` parameters (also comma or pipe separated). An item can belong to several menu groups.
- **Chef's Kitchen and Party Orders:** Audio keep-alive and a 30-minute idle reload keep the Silk browser from closing the page.
- **Signage:** Order-ready banner is 240px tall with larger fonts. Playlists are in `server/data/signage-playlists.json`.
- **Out-of-stock notifications:** Batched in a 10-minute window, then one consolidated WhatsApp per location (duplicates removed, restocked items dropped). See `stockOrderNotification.js`.
- **Party orders:** The server builds invoice PDFs (`partyOrderPdf.js`). An evening job sends a WhatsApp PDF prep sheet of tomorrow's party orders to the chef and manager per location.
- **End-of-day void report:** An itemized CSV is sent to owners by WhatsApp at 10pm per location.
- **Receipt scanning:** Uploads go to Firebase Storage. GPT-4o extracts line items, which are saved in Firestore and linked to scanned transactions (View-receipt link per transaction). The Receipt Transactions page shows receipts by month, vendor, and item, with review and edit, plus item price-fluctuation analytics. Purchasers upload multiple receipts and pass the location so each parses into a transaction.
- **Bank statements:** The categorizer is entity-aware. The TechMind entity has IT categories and ADP, cloud, and SaaS rules, kept separate from the restaurant entity. Routes are in `routes/bankTransactions.js`.
- **Other money routes:** payroll, cash payments, and user management under `server/routes/`.
- **Removed:** The Soft Launch pages (routes, components, server endpoint, nav buttons).

## Related but separate
- `techmind-website/` is the TechMind Software Solutions marketing site (consulting, development, AI integration, training, featured project).
- The resume generators in `server/gen-cv-pdf*.js` are unrelated to the restaurant app. See the `senior-manager-resume` skill.

## Gotchas
- Don't put secrets, phone numbers, or `serviceAccountkey.json` in any committed file.
- Respect the per-location recipient logic when you add a notification. Don't send to the global list unless the location has no list.
- Business-day boundaries matter for order views and the 10pm report. TODO: record the business day cutoff time.

## TODO for the owner
- Reasons for design choices (SSE instead of polling, the 10-minute batching window, GPT-4o for receipts).
- Deployment steps for the server and where it runs.
- Known bugs and planned work.
- Anything tried and dropped.
