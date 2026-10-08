# NexBuy Importaciones

Public customer site: https://nexbuy-importaciones.juanperal05.chatgpt.site
Private owner dashboard: https://nexbuy-importaciones.juanperal05.chatgpt.site/admin

## Customer flow

The reviewed form is only for personal purchases. Wholesale and supplier-access buttons and FAQ links open WhatsApp at 5492996550378 with the requested preset messages. Legacy commercial requests remain visible in the private registry. Product requests include quantities and a link, reference or up to three images. Contact, destination and optional budget are collected. The page promises a first personal response within 24 hours, without promising a final quote or delivery deadline.

Explicit consent is required. Anonymous customers submit through a same-origin API protected with a one-time form token and HttpOnly cookie. The server validates and records the request in D1 before returning the fixed NexBuy notification payload. The browser then performs a standard multipart/form-data POST to FormSubmit. A server-issued return receipt lets the confirmation page finalize the record without relying on a cross-site form cookie. No automatic customer or supplier messages, purchases, charges, provider-contact disclosures or guaranteed prices.

The public page includes Open Graph and Twitter large-card metadata using `/og.png`, a 1200×630 brand card served as `image/png`; the existing favicon remains. Device-local drafts use a versioned envelope containing the form data and step, written after a 250 ms debounce and flushed when leaving or hiding the page. Legacy drafts are still readable. Restoring a draft never restores consent. Reset and a successful email return cancel pending writes and remove the draft; a handoff interrupted before confirmation keeps it. Malformed storage entries and unavailable/full browser storage are handled without losing in-memory input.

Local drafts and the last 50 device-local copies remain available. Older copies and emails are not backfilled into the new registry. The authoritative owner registry begins with this feature's deployment.

## Private registry

`/admin` shows a username/password login until a valid server session exists. Passwords are verified server-side with PBKDF2-SHA256 (100,000 iterations, random salt), using the hosted `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` and `ADMIN_PASSWORD_SALT` configuration. Passwords never appear in source or browser bundles. A successful login creates a random session token, stored only as a SHA-256 digest in D1. The browser receives an HttpOnly, Secure, SameSite=Strict cookie with an eight-hour lifetime. Every admin page and data request checks the session in D1. Logout revokes the server record. Forged identity headers do not grant access. Failed logins are limited to five per IP in a 15-minute window; only salted IP digests are stored. Missing configuration denies access. The public form remains anonymous. `/admin/`, `/admin.html` and the internal login-template alias redirect to `/admin`.

The dashboard shows total, today (Argentina time), last seven days and pending requests, with filters, 50-row pagination, full details and manual statuses (pending, quoted, accepted, closed). It distinguishes mail acceptance, failure and uncertain delivery. Changing status sends no message. Private HTML and APIs use `private, no-store`; client code contains no credentials or request data. The footer has no admin link. The public page has `<meta name="robots" content="index, follow">` and no X-Robots-Tag. Only `/admin` carries the noindex meta tag and X-Robots-Tag header, for both login and dashboard responses. No robots.txt file or route is added; it returns 404 without crawl-blocking rules.

## Delivery behavior

The recipient is fixed in the email module, and the email payload is produced server-side to juanperal05@gmail.com. Reply-To uses the customer's email only if email was selected. FormSubmit is a third-party delivery service; API acceptance does not guarantee inbox delivery. A failed or timed-out email leaves the durable request visible in the dashboard. Email is never retried automatically, avoiding duplicate notifications after uncertain delivery. Only the first registration grants an email attempt; a repeated POST with the same request id and token returns its existing result without granting a new attempt. The delivery report can finalize only the original pending attempt. The native FormSubmit redirect carries an expiring return receipt whose SHA-256 digest is stored in D1. The receipt is validated by a same-origin POST, can finalize only a sending request, and does not constitute proof of inbox receipt. The native form uses the fixed recipient, _next, _url, and _captcha=false; no automatic retry occurs.

Images accept JPG/PNG/WebP, up to 15 MB each at input. The browser decodes, resizes to at most 1600 px, strips metadata via canvas re-encoding to JPEG, and compresses to at most 1 MB each and 3 MB total. Full draft image blobs are cached in device-local IndexedDB; metadata, safe thumbnails and the form step are in localStorage. Storage failure leaves in-memory images usable and displays a re-upload warning. Reviews and local request history show thumbnails. Full image bytes go directly to FormSubmit, not into D1; D1 stores validated attachment metadata only.

## Storage and build

Sites owns the logical `DB` D1 binding declared in `.openai/hosting.json`. Schema lives in `db/schema.ts`; Drizzle generates schema-only migrations under `drizzle/`, copied to `dist/.openai/drizzle`. Applied migrations are immutable. Data access uses single prepared statements and atomic D1 batches.

`npm run db:generate` after schema changes. `npm run check` validates source syntax. `npm run build` embeds the existing HTML, JS, CSS and fonts into a Cloudflare-compatible Worker ES module at `dist/server/index.js`. This preserves the form's existing visual design without adding a framework. Configure `ADMIN_USERNAME` and the password hash/salt as Sites runtime variables before deployment; hash and salt are stored as secrets. The generated password is handed only to the owner and is not committed.

Verification: `node scripts/verify-registry.mjs` after a build exercises the actual Worker with an in-memory SQLite D1 adapter and mocked outbound mail. It covers consent, server validation, private access, durable storage before mail, idempotency, delivery failure retention, counts, filters, details and owner status changes, username/password authentication, session revocation, login rate limiting, and public/admin indexing rules. UI flow verification uses `node scripts/verify-form.mjs`. `node scripts/verify-images.mjs` additionally verifies actual JPEG output with the runtime Sharp codec, image UI flows and multipart file parts using JSDOM; its canvas adapter is not a real browser test.

The managed preview does not support this Worker/static architecture; browser visual QA is unavailable in that profile. DOM workflow checks cover the customer and admin flows. Native successful deployment verifies publication; live D1 inspection verifies schema provisioning.
