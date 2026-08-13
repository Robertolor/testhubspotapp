# AWS SAM — shared SQS + Lambda worker

Deploys one Standard SQS queue, a DLQ, a Lambda consumer, and a DLQ depth alarm.
All tenants share this stack. Isolation is by `tenantId` on each message, not by
separate queues.

You do **not** paste AWS keys into chat. Deploy from your machine after
`aws sso login --profile <your-sandbox-profile>`.

## Prerequisites

- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- AWS CLI v2 with a sandbox profile that can create SQS, Lambda, IAM roles, and CloudWatch alarms
- Node 20+

## Deploy (sandbox)

```bash
aws sso login --profile YOUR_SANDBOX_PROFILE
aws sts get-caller-identity --profile YOUR_SANDBOX_PROFILE

cd infra/sam
sam build
sam deploy --guided --profile YOUR_SANDBOX_PROFILE
```

`--guided` asks for region, stack name, and parameter values, then writes
`samconfig.toml` (gitignored). Re-deploys after that:

```bash
sam build && sam deploy --profile YOUR_SANDBOX_PROFILE
```

Copy `JobQueueUrl` from the stack outputs. To send from Next.js (Vercel or local):

```
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/ACCOUNT/hubspot-sync-sbx-jobs
AWS_REGION=us-east-1
```

Plus AWS credentials that can `sqs:SendMessage` (local: `AWS_PROFILE=hubspot-sync-sbx`; Vercel: IAM user keys or OIDC). If `SQS_QUEUE_URL` is unset, the app still processes inline.

## Worker secrets (Chunk 3)

Lambda must decrypt **that tenant's** HubSpot/Mindbody tokens from Supabase, so it needs the same keys as the Next.js app. Do not put those in git or in SQS.

From `infra/sam`:

```powershell
.\deploy-sandbox.ps1 -Profile hubspot-sync-sbx
```

That reads `../../.env.local` and deploys. Required keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TOKEN_ENCRYPTION_KEY` (must match the app or tokens will not decrypt)
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`

## Local invoke (optional)

```bash
sam build
sam local invoke WorkerFunction -e events/process-webhook.json
```

## What this does not do yet

- Does not change Vercel webhook behavior until `SQS_QUEUE_URL` is set on the app
- Does not put secrets or webhook payloads in SQS
