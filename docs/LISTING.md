# HubSpot Marketplace listing pack (1.0)

Public app URL: `https://testhubspotapp.vercel.app`  
Privacy policy URL: `https://testhubspotapp.vercel.app/privacy`

## Support email

Production / listing address:

```text
integrations@methoddata.com
```

Set in Vercel (Production + Preview):

```text
NEXT_PUBLIC_SUPPORT_EMAIL=integrations@methoddata.com
```

Then redeploy. The privacy page reads this value.

## Listing copy (draft)

**App name:** Mindbody ↔ HubSpot Sync

**Tagline:** Sync Mindbody clients, sales, and contracts into HubSpot contacts and deals.

**Short description (≤80 chars):**  
Sync Mindbody contacts and deals with HubSpot CRM.

**Full description:**

Mindbody ↔ HubSpot Sync connects your Mindbody site to HubSpot so studio and wellness teams can keep CRM data aligned without spreadsheet exports.

After you install with HubSpot OAuth and connect your Mindbody site, you can:

- Sync contacts (Mindbody clients ↔ HubSpot contacts)
- Sync deals from Mindbody sales, contracts, appointments, and visits
- Sync sale line items onto HubSpot deals when available
- Map fields and deal pipeline stages per portal
- Review sync runs and errors in Reports
- Use Test Sync to validate mappings before relying on live traffic

Ongoing updates are driven by webhooks when Mindbody Push delivery is available for your site. Sandbox sites may not emit webhooks reliably; use Test Sync for validation.

**Categories:** CRM, Marketing, Operations / Fitness & Wellness (as available)

## Pricing model (document for HubSpot)

| Tier | Who | Notes |
|---|---|---|
| Free / beta (1.0) | Early installs | Single portal + Mindbody site; fair-use sync via Test Sync / webhooks |
| Paid (post-1.0) | TBD | Seat or site-based pricing after queue-backed backfill and commercial Mindbody activation |

Until paid plans launch, list the app as **free** (or “free during beta”) in the HubSpot listing and state that pricing may change with advance notice.

## Screenshots to capture (you take these)

Use a clean tenant with fake/demo data only.

1. **Home / install** — `https://testhubspotapp.vercel.app` (Install with HubSpot)
2. **Setup** — `/setup` after install
3. **Settings** — Mindbody connected + sync toggles visible
4. **Field mappings** — `/settings/mappings` (optional but strong)
5. **Reports list** — `/reports` with completed/partial runs
6. **Run detail** — one completed contact or deal run with success events

Export PNG, 1280px+ wide if possible. No real customer PII.

## HubSpot developer checklist (manual)

- [ ] Distribution → Acceptable Use Policy signed
- [ ] Redirect URL: `https://testhubspotapp.vercel.app/api/oauth/hubspot/callback`
- [ ] Scopes match `lib/hubspot/config.ts` (`HUBSPOT_SCOPES`)
- [ ] Listing fields: privacy URL, support email, description, screenshots, pricing
- [ ] `HUBSPOT_APP_ID` set in Vercel

## Explicitly deferred (not 1.0 blockers)

- Inngest / durable queue for 1000s of records → **1.0.1+**
- Commercial Mindbody site activation (no customer API keys) → **1.0.1**
- Reliable Mindbody sandbox UI webhooks → validate on live activated site
