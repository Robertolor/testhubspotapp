# Runtime fallback — operations guide

How to keep tenants (e.g. Gritcity) safe while expanding sync capabilities.

## Two systems until cutover

| System | Role |
|--------|------|
| **HubSpot App** | Ongoing sync, webhooks, tenant settings |
| **Gritcity CLI** (`mindbody-hubspot-migration`) | Full migration, scoped pushes, emergency fixes |

Do **not** run both full syncs on the same HubSpot portal at the same time.

## Runtime controls (Settings)

Per-tenant toggles in **Settings → Runtime sync controls**:

| Control | Default | Effect |
|---------|---------|--------|
| Min purchase amount | empty (no filter) | Skips sale/purchase deals at or below threshold |
| Appointments / Visits / Line items | off | Appointments + visits: sync via test/deal path when on. Line items: sync on qualifying sales when on |
| Link deals to contacts | on | Matches current `createDeal` association behavior |
| Default deal pipeline | empty | When set, synced deals get pipeline + stage from Mindbody status |
| Link line items to deals | off | Associates line items with their purchase deal when both sync |
| Link purchases to contracts | off | No-op until purchase↔contract association ships |

**Turn off a broken feature** without redeploying: disable the toggle and save.

## Mapping tabs (Settings → Field mappings)

Expanded entity tabs appear in Field mappings when enabled in Runtime sync controls:

| Settings toggle | Mapping tab |
|-----------------|-------------|
| (always on) | Contacts |
| (always on) | Deals → Contracts / Sales |
| Appointments | Deals → Appointments |
| Visits | Deals → Visits |
| Line items | Line items |

Mappings can be configured before sync ships for that entity type.

## Out-of-order webhooks

Mindbody events can arrive out of order (for example, sale/contract before contact).

Current handling:

1. Deal sync still writes/upserts the deal
2. If contact lookup fails and deal-to-contact associations are enabled, app queues a pending link
3. On later contact sync, queued links for that `mindbody_client_id` are retried and associated
4. Failed retries back off by 5 minutes and keep last error for troubleshooting

## Phases

### Phase 1 — Build (now)

- App: contacts + contracts/sales only (existing)
- CLI: Gritcity full migration when needed
- New runtime columns default to safe values

### Phase 2 — Parity test

- Enable new toggles on Gritcity tenant only
- Compare app output vs CLI on **scoped client IDs** (not full portal)
- CLI remains authority until checklist passes

### Phase 3 — Cutover

- Gritcity mappings live in `/settings/mappings`
- Runtime toggles configured (e.g. min purchase `$25`)
- App is primary for ongoing sync
- CLI kept for emergency scoped pushes

## Cutover checklist (Gritcity)

- [ ] Contacts sync matches CLI on sample clients
- [ ] Purchases respect min amount filter
- [ ] Contracts + purchases sync with correct field mappings
- [ ] Associations work (contact↔deal, line item↔deal, purchase↔contract)
- [ ] Webhooks fire for ongoing changes
- [ ] No double-write: CLI not running full push on same portal

## If something breaks after cutover

1. **Disable the failing toggle** in Settings (fastest)
2. **Disable entity sync** (contacts/deals) if needed
3. **CLI scoped push** to fix data for specific clients/records
4. **Git revert** if a deploy introduced a code bug

## Code rollback vs runtime fallback

| | GitHub revert | Runtime toggles / CLI |
|--|---------------|------------------------|
| Fixes bad deploy | Yes | No |
| Stops bad sync without deploy | No | Yes |
| Fixes historical data | No | CLI scoped push |

GitHub protects code. Toggles + CLI protect live data.
