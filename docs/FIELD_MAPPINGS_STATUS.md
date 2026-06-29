# Field mappings — achievement summary

> **Branch:** `feature/field-mappings`  
> **Milestone:** Phases **A–D complete** (stop before Phase E)  
> **Last updated:** 2026-06-04  
> **Design doc:** [FIELD_MAPPINGS.md](./FIELD_MAPPINGS.md) (full plan + progress log)

This document summarizes what was built and verified on the feature branch. Use it before merging to `main` or planning the next slice of work.

---

## Executive summary

Tenants can now **configure Mindbody ↔ HubSpot field mappings** in the app:

- Browse HubSpot and Mindbody field catalogs (contacts; deals HubSpot-only for Mindbody source)
- View saved mappings with **system rows locked** (Email, Client ID)
- **Add**, **remove**, and **save** mappings with server-side validation

**Contact sync still uses the original `String()` transform** for mapped values. Custom fields (`custom:3`), nested paths (`HomeLocation.Id`), and proper date/number formatting are **not wired yet** (Phase E). Deal sync **ignores** saved deal mappings (Phase F).

Phases A–D are a shippable **mapping configuration** feature. Phase E is required before exotic mappings affect sync correctly.

---

## What was achieved (verified on preview)

### Phase A — Read-only catalog APIs

| Step | Endpoint | Verified |
|------|----------|----------|
| 1.1 | `GET .../mapping/catalog/hubspot?object=contacts` | ✅ |
| 1.2 | `GET .../mapping/catalog/hubspot?object=deals` | ✅ |
| 1.3 | `GET .../mapping/catalog/mindbody?entity=contact` | ✅ (32 standard + 3 nested + 17 custom) |
| 1.4 | `GET .../mapping/fields?entity=contact\|deal` | ✅ |

### Phase B — Schema and validation

| Step | Deliverable | Verified |
|------|-------------|----------|
| 2.1 | DB columns: `is_system`, `hubspot_property_type`, `mindbody_field_type` | ✅ Supabase migration applied |
| 2.2 | `lib/mapping/validate.ts` + `npm run validate:mapping` | ✅ |

### Phase C — Read-only UI

| Step | Deliverable | Verified |
|------|-------------|----------|
| 3.1 | `/settings/mappings` page, Contacts/Deals tabs | ✅ |
| 3.2 | Searchable HubSpot + Mindbody catalog panels | ✅ |
| 3.3 | Saved mappings list, System lock badges | ✅ |

### Phase D — Save and edit UI

| Step | Deliverable | Verified |
|------|-------------|----------|
| 4.1 | `PUT .../mapping/fields` with validation | ✅ Save persists; type warnings (e.g. number → string) |
| 4.2 | Add/remove rows, searchable pickers, Save/Cancel | ✅ Add, remove + save, refresh |

---

## How to use (preview)

### URLs

| Environment | URL |
|---------------|-----|
| **Preview** (feature branch) | `https://testhubspotapp-git-feature-field-6f1c27-roberto-6909s-projects.vercel.app` |
| **Mappings page** | `/settings/mappings` |
| **Production** (`main`) | `https://testhubspotapp.vercel.app` — **no mapping feature until merge** |

Preview uses a **separate OAuth cookie**. Install with HubSpot once per preview host. Add preview callback in HubSpot Legacy app:

`https://testhubspotapp-git-feature-field-6f1c27-roberto-6909s-projects.vercel.app/api/oauth/hubspot/callback`

### Prerequisites

1. HubSpot connected (OAuth on the same host you use)
2. Mindbody credentials saved in Settings (`-99` sandbox OK for catalogs)
3. Supabase migration `20250604120000_field_mapping_metadata.sql` applied

### Typical workflow

1. Open **Mappings** in the nav
2. Choose **Contacts** or **Deals**
3. Review **Current mappings** (system rows cannot be removed)
4. Click **+ Add mapping** → search HubSpot and Mindbody fields → **Save mappings**
5. Optional: expand **Browse field catalogs** to explore all fields

---

## What sync does today (important)

| Behavior | Status |
|----------|--------|
| Default contact mappings (`email`, `firstname`, `lastname`, `phone`, `mindbody_client_id`) | ✅ Used by contact sync (flat fields) |
| User-added **standard** flat mappings (e.g. `Notes` ↔ `notes`) | ✅ Synced via `String(value)` |
| **Custom** Mindbody keys (`custom:3`) in saved mappings | ❌ Not extracted in sync (UI only) |
| **Nested** keys (`HomeLocation.Id`) | ❌ Not extracted in sync |
| **Type-aware** format (dates, numbers, enums) | ❌ Everything coerced with `String()` |
| `mindbody_site_id`, `mindbody_last_synced_at` | Still set automatically on every contact sync (not from mapping UI) |
| Deal mappings saved in UI | ❌ `lib/sync/deals.ts` still hardcoded |
| Reverse sync (HubSpot → Mindbody) | Partial; not driven by dynamic mappings |

**Implication:** Safe to ship for studios that only need standard contact fields. Warn users that custom/nested mappings are “saved for later” until Phase E.

---

## New and changed files (feature branch)

### APIs

```
GET  /api/tenants/[tenantId]/mapping/catalog/hubspot?object=contacts|deals
GET  /api/tenants/[tenantId]/mapping/catalog/mindbody?entity=contact
GET  /api/tenants/[tenantId]/mapping/fields?entity=contact|deal
PUT  /api/tenants/[tenantId]/mapping/fields
```

### Libraries

| Path | Purpose |
|------|---------|
| `lib/hubspot/property-catalog.ts` | HubSpot property list + normalize |
| `lib/mindbody/field-catalog.ts` | Mindbody contact field list + custom fields API |
| `lib/mapping/fields.ts` | Entity parse + API DTOs |
| `lib/mapping/validate.ts` | Type + system mapping validation |
| `lib/mapping/save-field-mappings.ts` | PUT handler logic |
| `lib/mapping/deal-fields.ts` | Static deal Mindbody fields (until 6.1) |

### UI

| Path | Purpose |
|------|---------|
| `app/(dashboard)/settings/mappings/page.tsx` | Mappings page |
| `components/field-mappings-shell.tsx` | Tabs, load catalogs + mappings, save |
| `components/mappings-editor-panel.tsx` | Add/remove/save rows |
| `components/mapping-field-picker.tsx` | Searchable field combobox |
| `components/mapping-catalog-panel.tsx` | Browse-only catalog lists |
| `components/dashboard-nav.tsx` | **Mappings** nav link |

### Database

| Migration | Purpose |
|-----------|---------|
| `supabase/migrations/20250604120000_field_mapping_metadata.sql` | `is_system`, type columns + backfill |

### Scripts

```bash
npm run validate:mapping   # validation self-check (step 2.2)
npm run typecheck
```

---

## Deferred work (not in this milestone)

### Phase E — Sync transforms (recommended next branch)

| Step | Work |
|------|------|
| 5.1 | `lib/mapping/transform.ts` — `extractMindbodyValue`, `formatForHubspot`; unit/self-check tests |
| 5.2 | Wire `applyContactMappings` in `lib/sync/field-mappings.ts` |

Verify with sample JSON, not sandbox roulette. Optional: one known-good sandbox client later.

### Phase F — Deals

| Step | Work |
|------|------|
| 6.1 | Mindbody sale + contract catalog APIs |
| 6.2 | Deal mapping UI (sale vs contract) |
| 6.3 | Wire `lib/sync/deals.ts` to `field_mappings` |

### Phase G — Nice-to-have

- Create HubSpot property from UI
- HubSpot → Mindbody dynamic reverse mappings
- Backfill prompt when mappings change
- Server-side catalog search / pagination for large portals

---

## Merge checklist (`feature/field-mappings` → `main`)

- [ ] Supabase: migration `20250604120000_field_mapping_metadata.sql` applied on production project
- [ ] Vercel: deploy from `main` after merge; env vars unchanged
- [ ] HubSpot Legacy app: production redirect URL already registered
- [ ] Smoke test on production: `/settings/mappings` loads, catalogs fetch, save round-trip
- [ ] Confirm contact test sync still works with **default** mappings (optional; sandbox emails may partial-fail)
- [ ] Update `FIELD_MAPPINGS.md` header “what exists today” table if desired

**Do not merge** until migration is on production Supabase — PUT/GET mappings expect the new columns.

---

## Open product decisions (unchanged)

1. **Strict vs permissive** type mismatch on save? (Currently: block hard errors, allow coercion with warnings.)
2. **Allow** two HubSpot properties → same Mindbody field? (Currently: blocked.)
3. **Deals UI:** one page with source column vs sale/contract tabs?
4. **Create HubSpot property** from UI in v1 or later?
5. **Re-sync / backfill** when mappings change?

---

## Related production context

| Item | Value |
|------|--------|
| HubSpot portal (sandbox) | `50339335` |
| Example tenant ID | `97a3b9c7-74c9-44ff-9201-eec8735e2154` |
| Mindbody sandbox site | `-99` |
| Stable `main` (pre-feature) | Contact sync partial on sandbox; deals 6/6 E2E |

---

## Recommendation

**Merge Phases A–D** as “field mapping configuration (beta)” if you want the UI and persistence in production. Treat **custom/nested mappings and deal mappings** as configure-only until Phases E and F.

**Next branch:** `feature/field-mapping-sync` (or continue on same branch) for Phase E only, with self-check tests and no dependency on sandbox data quality.
