# Infrastructure acceptance — source of truth

This document defines **what we intended to build**, **what is live today**, and **how to verify** it. Run automated checks before marketplace submit, SQS cutover, or major releases.

## Architecture decision (locked)

| Layer | Choice | Notes |
|-------|--------|--------|
| Ingress | Vercel (Next.js) | OAuth, webhooks, UI, settings |
| Durable work | **AWS SQS + Lambda** (Option A) | One shared Standard queue + DLQ for all tenants |
| Tenant isolation | `tenantId` on every message + DB row | Not separate queues per tenant |
| Secrets | Supabase only | Never in SQS body |
| Inline fallback | When `SQS_QUEUE_URL` unset | Vercel runs jobs in-process (current production) |
| Deferred | Inngest | Scaffolded, not production path — remove later |
| Deferred | iHub | Not in scope |

## Environment matrix

### Vercel Production (marketplace / live app)

| Variable | Required | Expected for 1.0 |
|----------|----------|------------------|
| `HUBSPOT_CLIENT_ID` | Yes | Set |
| `HUBSPOT_CLIENT_SECRET` | Yes | Set |
| `HUBSPOT_APP_ID` | Yes | Set (webhooks on install) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Set |
| `TOKEN_ENCRYPTION_KEY` | Yes | Set |
| `SESSION_SECRET` | Yes | Set |
| `MINDBODY_DEVELOPER_API_KEY` | Yes | Set |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Yes | `roberto@methoddata.com` |
| `SQS_QUEUE_URL` | No until cutover | **Unset** until real-tenant queue test |
| `AWS_REGION` | If SQS enabled | `us-east-1` when cutover |

### AWS Lambda worker (sandbox stack)

Same Supabase + encryption + HubSpot OAuth keys as the app. Deploy via `infra/sam/deploy-sandbox.ps1`.

Stack outputs: `JobQueueUrl` → becomes `SQS_QUEUE_URL` on Vercel when ready.

## Acceptance criteria

Legend: **PASS** = must be true to ship / cutover · **DEFERRED** = explicitly later · **MANUAL** = human checklist

### Code & contracts

| ID | Criterion | Status | Verify |
|----|-----------|--------|--------|
| C1 | SQS message has `tenantId`, `jobType`, no tokens/payload | PASS | `npm run validate:queue` |
| C2 | Dispatch inline when `SQS_QUEUE_URL` unset | PASS | `npm run validate:dispatch` |
| C3 | Replay scoped to calling tenant (`tenant_id` match) | PASS | `npm run verify:infra -- --mode static` |
| C4 | Unknown tenant → permanent drop (no infinite retry) | PASS | `lib/queue/worker.ts` + Lambda logs |
| C5 | Suspended tenant jobs skipped | PASS | `lib/queue/worker.ts` |
| C6 | Runtime / cutoff / mapping self-checks pass | PASS | `npm run validate:all` |

### AWS (sandbox)

| ID | Criterion | Status | Verify |
|----|-----------|--------|--------|
| A1 | Standard queue + DLQ + redrive (max 3) | PASS | SAM template + `--mode aws` |
| A2 | DLQ depth CloudWatch alarm | PASS | SAM template + `--mode aws` |
| A3 | Lambda Node 22, batch size 1, partial batch failures | PASS | SAM template |
| A4 | Smoke: send job → Lambda processes or drops unknown tenant | MANUAL | `infra/sam/README.md` |

### Vercel / product

| ID | Criterion | Status | Verify |
|----|-----------|--------|--------|
| V1 | OAuth install → `/setup` | MANUAL | Install smoke |
| V2 | Mindbody connect + Test Sync + Reports | MANUAL | Settings smoke |
| V3 | Public `/terms`, `/privacy`, `/setup-guide` (200) | PASS | `npm run verify:infra -- --mode urls` |
| V4 | Site footer: legal + support links | PASS | Visual / urls mode |
| V5 | `SQS_QUEUE_URL` **not** set on prod until cutover | MANUAL | Vercel dashboard |

### Security

| ID | Criterion | Status | Verify |
|----|-----------|--------|--------|
| S1 | Tokens encrypted at rest | PASS | `lib/crypto/secrets.ts` |
| S2 | Webhook signature verification | PASS | HubSpot + Mindbody verify modules |
| S3 | API keys not returned from settings GET | PASS | settings route |
| S4 | OAuth v3 token endpoints | DEFERRED | Listing blocker — migrate before submit |

### Marketplace (see also `docs/HUBSPOT_SUBMIT_CHECKLIST.md`)

| ID | Criterion | Status |
|----|-----------|--------|
| M1 | Terms + Privacy + Setup guide URLs live | PASS (after deploy) |
| M2 | Support email in Vercel | MANUAL |
| M3 | 3 active external HubSpot installs | MANUAL |
| M4 | Listing assets + AUP signed | MANUAL |

## Commands (run in order)

```bash
# Every PR / before push
npm run validate:all

# Static infra contract (no network)
npm run verify:infra -- --mode static

# Public pages (production or preview URL)
npm run verify:infra -- --mode urls

# Local .env.local keys (optional)
npm run verify:infra -- --mode env

# AWS sandbox (needs SSO login + profile)
npm run verify:infra -- --mode aws --profile hubspot-sync-sbx

# Everything available
npm run verify:infra -- --mode all --profile hubspot-sync-sbx
```

## Manual smoke (before SQS cutover or marketplace submit)

- [ ] Install with HubSpot → lands on `/setup`
- [ ] Save Mindbody credentials → connection succeeds
- [ ] Sync 20 contacts → Reports shows completed/partial
- [ ] Sync 20 deals (alone) → Reports completes
- [ ] Replay webhook for wrong tenant → rejected
- [ ] Privacy / Terms / Setup guide show support email (after env set)
- [ ] Manager sign-off on deferred: bulk queue on Vercel, Mindbody activation model

## Cutover to SQS (when ready — not 1.0)

1. Real-tenant test with `SQS_QUEUE_URL` on **preview** only
2. Confirm Lambda logs, DLQ empty, no secret leakage in messages
3. Set `SQS_QUEUE_URL` + `AWS_REGION` on Vercel production
4. Re-run manual webhook + sync smoke
5. Update this doc: V5 → PASS

## Deferred (do not block 1.0 listing)

- Inngest removal
- OAuth v3 migration (**do before marketplace submit**)
- 14-day staging retention
- Billing / usage events
- Commercial Mindbody activation (no customer API keys)
- FE/BE split on Vercel
