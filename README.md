# La Infinitè™ — The Maison

A folder-based luxury storefront for LA INFINITÉ (Pty) Ltd. Cream, nude and oxford blue; a typographic wordmark; product-led photography; responsive monospace typography.

## Structure

Every page has its own folder and `index.html`. The two product pages are under `products/`. All ten requested menu destinations are present. Shared behaviour is in `js/store.js`; styling is in `styles/maison.css`; catalogue records are in `data/catalog.json`. Original photographs remain in `assets/` with their original filenames. `scripts/build.py` generates the HTML pages, metadata, sitemap and the deployment copy in `dist/`.

## Edit and build

1. Update `data/catalog.json` for catalogue data and `data/site.json` for the site origin and configuration.
2. Update `scripts/build.py` for page structure, copy, legal text and templates. Generated HTML should not be edited directly.
3. Run `python3 scripts/build.py` and `npm run check`. No application dependencies are required.

`SITE_ORIGIN`, `SITE_BASE_PATH` and `SITE_PREVIEW` can override configuration at build time. The current private review edition deliberately uses `noindex, nofollow` and blocks crawling. At public launch, select the final domain, confirm business policies, set `SITE_PREVIEW=false` and rebuild. For GitHub Pages beneath the repository path, use `SITE_ORIGIN=https://maisonlainfinite.github.io` and `SITE_BASE_PATH=/maisonlainfinite`; rebuild before publication. No public Pages deployment is triggered by this repository.

## Working in this edition

- Two complete product galleries, image enlargement, details, production notes and enquiry links.
- Catalogue search, category/availability/price filters and sorting, plus useful empty collection states.
- Indicative EU/US/UK size selection with a stable underlying EU preference.
- Device-local bag, quantity editing, removal, expiry, and destination-based shipping estimates.
- Personal order enquiries through the client's email app. Bag contents are retained; no payment or binding order is silently created.
- Contact, newsletter and membership invitation forms prepare email requests to `maisonlainfinite@outlook.com`. They do not claim that an email was sent or a customer subscribed.
- Consent banner with equally accessible optional acceptance and refusal, saved preferences and withdrawal. Optional analytics stay local and never load a third-party tracker.
- Maison Circle tiers: $500 Bronze; $1,000 Silver; $5,000 Gold; $15,000 Platinum. No unverified purchase history or fake points.
- Per-page titles, descriptions, canonical URLs, Open Graph/X text metadata, Organization/OnlineStore, Brand, WebSite, WebPage, BreadcrumbList, catalogue ItemList and product/offer JSON-LD. Confirmed US, UK and South African shipping rates are included in product offers. No fabricated reviews or review stars.
- Keyboard dialogs, accessible forms, focus styles, reduced-motion support, mobile layouts and graceful static browsing.

## Integrations intentionally pending

Firebase authentication, customer profiles, server-side orders, newsletters, order tracking and verified loyalty ledgers remain to be integrated. The account interface clearly explains that accounts are not yet active and does not collect passwords. PayPal is visibly unavailable until the payment service is configured. Never replace these notices with success messages before the relevant service exists.

Cart data is local convenience state, not an authoritative order. The future backend must validate product IDs, prices, supported sizes, inventory, destination rates, taxes, access controls and payment status. Only verified completed payments should accrue loyalty spend; refunds must reverse the relevant eligible amount. Do not trust browser totals or store passwords/payment secrets in browser storage.

## Commercial information to confirm before accepting online payments

- Registered business number, service address, information-officer and required merchant disclosures.
- A maker-verified size chart, exact available sizes, dimensions, stock/production status and tax treatment for each destination.
- Crocodile material/species documentation and any destination permits required for L’Ivoire. The bag material is described according to the owner's brief and has not been independently authenticated.
- Parcel weights/dimensions, origin postcode, carrier account and real destination quotes outside the confirmed free regions and South Africa. Unknown shipping is deliberately quoted individually, not invented.
- Precise voluntary return windows, prepaid-return arrangements, refund operations and treatment of genuinely personalised orders. A qualified adviser should review policies against the actual business operations and target markets. The policies preserve statutory rights and do not turn internal assessment into an absolute bar on refunds.
- Membership enrolment rules, benefit fulfilment and the complimentary Platinum gift. Proposed benefits are not presented as active account entitlements.

The owner supplied complimentary express delivery for Europe, UK and USA, and $60 shipping from Italy to South Africa; this edition applies those regional terms to both current products. Confirm any product-specific exceptions before launch.

## Reference sources consulted on 8 October 2026

These sources informed the structure and conservative policy drafting; they do not certify legal compliance or establish carrier rates for an unknown parcel.

- [Gucci official site](https://www.gucci.com/za/en_gb/) — navigation and client-service conventions. No Gucci branding, imagery or proprietary copy is used.
- [DHL Italy quote guide](https://www.dhl.com/it-en/home/get-a-quote.html) — destination, origin, weight, dimensions and service are required for a useful rate.
- [South African Consumer Protection Act](https://www.gov.za/documents/consumer-protection-act).
- [Information Regulator: POPIA](https://inforegulator.org.za/popia/) and [direct-marketing guidance](https://inforegulator.org.za/guidance-notes/).
- [EU consumer shopping rights](https://europa.eu/youreurope/citizens/consumers/shopping/shopping-consumer-rights/index_en.htm).
- [UK returns and refunds guidance](https://www.gov.uk/accepting-returns-and-giving-refunds).
- [CITES import/export guidance](https://www.gov.uk/guidance/cites-imports-and-exports).
- [Schema.org Product](https://schema.org/Product) and [OfferShippingDetails](https://schema.org/OfferShippingDetails).

Copyright © 2026 LA INFINITÉ (Pty) Ltd. All rights reserved, subject to applicable third-party rights.
