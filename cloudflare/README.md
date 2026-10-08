# Free Cloudflare Pages publication

The production Site remains the durable registry and authentication server. Pages serves a copy of the public assets and proxies only `/api/*` and `/admin*` to that fixed Site. The upload contains no credentials, database export, customer records or administration HTML. Do not delete the original Site or make it private: the Pages proxy needs its existing public endpoints.

Build for the actual production address (the example is not reserved yet):

```sh
npm run build
node scripts/build-cloudflare.mjs https://nexbuyimportaciones.pages.dev
node scripts/verify-cloudflare.mjs
```

Publish `cloudflare-build/` using Cloudflare Pages Direct Upload. Its root includes `_worker.js`, supported by dashboard drag-and-drop, and `_routes.json`. Create a Pages project named `nexbuyimportaciones`, select the free plan, and do not buy a domain or enable paid services. If Cloudflare assigns a different production name, rebuild with that exact address before uploading. The Worker fails closed on other hostnames; temporary preview URLs deliberately cannot access the private registry.

The public social metadata points to the Pages address. The proxy validates the browser's same-origin mutation requests before forwarding them to the original server; it retains server authentication, HttpOnly cookies, no-store private responses, exact delivery receipts and idempotent registration. The FormSubmit handoff returns to the Pages URL. Images are still sent directly as native multipart attachments, never uploaded to the registry or this proxy.

Cloudflare Pages static traffic is free and does not invoke the Worker. API and administration calls consume the daily free Workers allowance. Existing requests stay in the original D1 database; no database migration or paid Cloudflare resource is required. Since the original server sees traffic from the Pages proxy, its login limit can be shared by Pages visitors; authentication remains protected and conservatively rate-limited.

Local verification uses the actual existing Worker with an in-memory SQLite D1 adapter and the actual Pages proxy. It checks registration, receipt completion, native FormSubmit handoff, authenticated access, cookies and CSRF. It sends no live email. After publication, confirm the actual project URL, OG image, anonymous admin rejection and a single explicitly identified technical submission. FormSubmit may request activation for the new page; owner approval of its activation email is outside this build. Browser draft/history storage is separate for each hostname.
