# HubSpot Marketplace checklist (1.0)

Public app: `https://testhubspotapp.vercel.app`  
Listing notes: see [LISTING.md](./LISTING.md)

## Status legend

- **Done** — validated for this tenant / staging
- **You** — manual HubSpot / Mindbody / ops step
- **Build** — app work still needed for listing
- **Later** — explicitly deferred past 1.0

## HubSpot developer app

- [x] **Done** — Public OAuth app exists; install works on staging
- [x] **Done** — Redirect: `https://testhubspotapp.vercel.app/api/oauth/hubspot/callback`
- [x] **Done** — Scopes in `lib/hubspot/config.ts` (contacts/deals/line items + schemas)
- [x] **Done** — OAuth token exchange/refresh/introspect use `/oauth/2026-03` (not v1)
- [ ] **You** — Confirm `HUBSPOT_APP_ID` is set in Vercel Production
- [ ] **You** — Sign Acceptable Use Policy (Distribution tab)

## Install flow

- [x] **Done** — Install → `/setup`
- [x] **Done** — Session cookie; dashboard routes work
- [x] **Done** — Custom HubSpot properties under **mindbody_sync**

## Mindbody (1.0 credential model)

- [ ] **You** — Developer account approved for live API access (when leaving sandbox)
- [x] **Done** — Sandbox site `-99` connectable with Site ID + API key + staff login
- [x] **Done** — Webhook subscription create/activate path exists; verify Active in Mindbody metrics
- [ ] **Later** — Commercial site activation (no customer API keys) → **1.0.1**

## Sync E2E

- [x] **Done** — Contacts via Test Sync (`mb_to_hs`)
- [ ] **You** — Optional: confirm `hs_to_mb` if you advertise bi-directional contacts
- [x] **Done** — Deals (sales/contracts) + line items when sale has items
- [x] **Done** — Pipeline stage mappings in Settings
- [x] **Done** — Reports show runs; failures/skips visible (failures now in Events too)
- [ ] **Later** — Large backfill (1000s) without timeout → queue after 1.0

## Webhooks

- [x] **Done** — Invalid HubSpot / Mindbody signatures rejected
- [x] **Done** — Idempotent deliveries
- [x] **Done** — Replay route exists
- [ ] **Later** — Treat Mindbody sandbox UI webhooks as unreliable; validate on live site

## Security

- [x] **Done** — Tokens encrypted (`TOKEN_ENCRYPTION_KEY`)
- [x] **Done** — API keys not returned from settings GET
- [x] **Done** — Service role key server-only

## Listing pack

- [x] **Build** — Privacy policy page: `/privacy`
- [ ] **You** — Set `NEXT_PUBLIC_SUPPORT_EMAIL=integrations@methoddata.com` in Vercel and redeploy
- [ ] **You** — Capture screenshots (see LISTING.md)
- [x] **Build** — Pricing model draft in LISTING.md (free/beta for 1.0)
- [ ] **You** — Paste privacy URL, support email (`integrations@methoddata.com`), copy, screenshots into HubSpot listing

## After 1.0 (do not block listing)

- Durable job queue (Inngest or equivalent)
- Mindbody commercial activation onboarding
- Value-mapping UI (if still desired)
