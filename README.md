# Mindbody ↔ HubSpot Sync

HubSpot marketplace app that syncs **Contacts** and **Deals** between Mindbody and HubSpot. Built as a single [Next.js](https://nextjs.org) project deployable to Vercel, with [Supabase](https://supabase.com) Postgres for multi-tenant storage.

## Stack

- **Frontend:** React 19 (App Router)
- **Backend:** Next.js API routes (Node.js on Vercel)
- **Database:** Supabase PostgreSQL
- **Background jobs:** Inngest (optional; falls back to inline processing in dev)

## Quick start

### 1. Supabase

Create a project and run the migration:

```bash
# Using Supabase CLI
supabase db push
# Or apply supabase/migrations/20250601000000_initial_schema.sql in the SQL editor
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in values:

- HubSpot developer app (OAuth + `HUBSPOT_APP_ID` for webhooks)
- Mindbody developer API key
- Supabase URL + service role key
- `TOKEN_ENCRYPTION_KEY` and `SESSION_SECRET` (32+ char random strings)

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Install with HubSpot**.

For background jobs in development:

```bash
npx inngest-cli@latest dev
```

### 4. Deploy to Vercel

Connect the repo, set the same environment variables, and deploy. Webhook URLs:

- `https://your-domain.com/api/webhooks/hubspot`
- `https://your-domain.com/api/webhooks/mindbody`

Short paths via rewrites: `/webhooks/hubspot`, `/oauth/hubspot/callback`.

## API routes

| Route | Description |
|-------|-------------|
| `GET /api/oauth/hubspot` | Start HubSpot OAuth |
| `GET /api/oauth/hubspot/callback` | OAuth callback |
| `POST /api/webhooks/hubspot` | HubSpot CRM webhooks |
| `POST /api/webhooks/mindbody` | Mindbody push events (`HEAD` supported) |
| `GET/PUT /api/tenants/[id]/settings` | Tenant configuration |
| `GET /api/tenants/[id]/sync-runs` | Sync run + error reports |
| `POST /api/tenants/[id]/sync/full` | Queue backfill |

## Mindbody deal mapping

HubSpot deals are created from:

- **Contracts** (`clientContract.*`) → `deal_source: mindbody_contract`
- **Sales** (`clientSale.created`) → `deal_source: mindbody_sale`

## Marketplace checklist

See [docs/MARKETPLACE_CHECKLIST.md](docs/MARKETPLACE_CHECKLIST.md) for HubSpot listing and E2E test steps.

## License

Private — all rights reserved.
