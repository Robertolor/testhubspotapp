# HubSpot Marketplace checklist

Use this on staging before submitting the app for review.

## HubSpot developer app

- [ ] Create public OAuth app in [HubSpot developers](https://developers.hubspot.com/)
- [ ] Set redirect URL: `https://<staging>/api/oauth/hubspot/callback`
- [ ] Request scopes: `oauth`, `crm.objects.contacts.read/write`, `crm.objects.deals.read/write`
- [ ] Set `HUBSPOT_APP_ID` for webhook subscription API
- [ ] Sign Acceptable Use Policy (Distribution tab) for non-test installs

## Install flow

- [ ] Install via sample install URL → lands on `/setup`
- [ ] Session cookie issued; dashboard routes accessible
- [ ] Custom HubSpot properties created under **mindbody_sync** group

## Mindbody

- [ ] Developer account approved for live API access
- [ ] Business activated with developer API key
- [ ] Save Site ID + API key in Settings → connection test passes
- [ ] Webhook subscription created and active

## Sync E2E

- [ ] Enable contacts `mb_to_hs` → create client in Mindbody → contact in HubSpot
- [ ] Enable contacts `hs_to_mb` → update contact in HubSpot → Mindbody client updates
- [ ] Enable deals → contract/sale in Mindbody → deal in HubSpot with association
- [ ] Reports show sync runs; errors visible with entity + external ID
- [ ] Backfill contacts completes without timeout (use Inngest in production)

## Webhooks

- [ ] Invalid HubSpot signature returns 401
- [ ] Invalid Mindbody signature returns 401
- [ ] Duplicate deliveries deduplicated (idempotency key)
- [ ] Replay via `POST /api/tenants/[id]/webhooks/replay` with `deliveryId`

## Security

- [ ] Tokens encrypted at rest (`TOKEN_ENCRYPTION_KEY`)
- [ ] API keys never returned from settings GET
- [ ] Service role key only on server

## Listing (when ready)

- [ ] Privacy policy URL
- [ ] Support contact email
- [ ] Screenshots of setup, settings, reports
- [ ] Pricing model documented
