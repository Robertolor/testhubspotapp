/**
 * Infrastructure verification — static, env, public URLs, optional AWS.
 *
 * Usage:
 *   npx tsx scripts/verify-infra.ts --mode static
 *   npx tsx scripts/verify-infra.ts --mode urls --base-url https://testhubspotapp.vercel.app
 *   npx tsx scripts/verify-infra.ts --mode env
 *   npx tsx scripts/verify-infra.ts --mode aws --profile hubspot-sync-sbx
 *   npx tsx scripts/verify-infra.ts --mode all --profile hubspot-sync-sbx
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

type Mode = "static" | "env" | "urls" | "aws" | "all";

const REQUIRED_APP_ENV = [
  "HUBSPOT_CLIENT_ID",
  "HUBSPOT_CLIENT_SECRET",
  "HUBSPOT_APP_ID",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "TOKEN_ENCRYPTION_KEY",
  "SESSION_SECRET",
  "MINDBODY_DEVELOPER_API_KEY",
] as const;

const MARKETPLACE_ENV = ["NEXT_PUBLIC_SUPPORT_EMAIL"] as const;

const PUBLIC_PATHS = ["/", "/terms", "/privacy", "/setup-guide"] as const;

const DEFAULT_BASE_URL = "https://testhubspotapp.vercel.app";
const DEFAULT_STACK = "hubspot-sync-sbx";
const DEFAULT_QUEUE_SUFFIX = "hubspot-sync-sbx-jobs";

function parseArgs(): {
  mode: Mode;
  baseUrl: string;
  profile?: string;
  stackName: string;
} {
  const args = process.argv.slice(2);
  let mode: Mode = "static";
  let baseUrl = process.env.VERIFY_BASE_URL?.trim() || DEFAULT_BASE_URL;
  let profile = process.env.AWS_PROFILE?.trim();
  let stackName = DEFAULT_STACK;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mode" && args[i + 1]) {
      mode = args[++i] as Mode;
    } else if (arg.startsWith("--mode=")) {
      mode = arg.slice("--mode=".length) as Mode;
    } else if (arg === "--base-url" && args[i + 1]) {
      baseUrl = args[++i].replace(/\/$/, "");
    } else if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length).replace(/\/$/, "");
    } else if (arg === "--profile" && args[i + 1]) {
      profile = args[++i];
    } else if (arg.startsWith("--profile=")) {
      profile = arg.slice("--profile=".length);
    } else if (arg === "--stack" && args[i + 1]) {
      stackName = args[++i];
    } else if (arg.startsWith("--stack=")) {
      stackName = arg.slice("--stack=".length);
    }
  }

  return { mode, baseUrl, profile, stackName };
}

function ok(message: string): void {
  console.log(`  ✓ ${message}`);
}

function warn(message: string): void {
  console.warn(`  ⚠ ${message}`);
}

function fail(message: string): never {
  console.error(`  ✗ ${message}`);
  process.exit(1);
}

function readRepoFile(relativePath: string): string {
  const full = join(process.cwd(), relativePath);
  if (!existsSync(full)) {
    fail(`Missing required file: ${relativePath}`);
  }
  return readFileSync(full, "utf8");
}

function runStaticChecks(): void {
  console.log("\n[static] Repository infrastructure contract");

  const template = readRepoFile("infra/sam/template.yaml");
  const requiredSam = [
    "DeadLetterQueue",
    "JobQueue",
    "RedrivePolicy",
    "maxReceiveCount: 3",
    "DlqDepthAlarm",
    "ReportBatchItemFailures",
    "infra/sam/src/handler.handler",
  ];
  for (const needle of requiredSam) {
    if (!template.includes(needle)) {
      fail(`SAM template missing: ${needle}`);
    }
  }
  ok("SAM template has queue, DLQ, redrive, alarm, and worker handler");

  const messageTs = readRepoFile("lib/queue/message.ts");
  for (const forbidden of ["access_token", "refresh_token", "api_key", "payload"]) {
    if (messageTs.includes(`${forbidden}:`)) {
      fail(`queue message schema must not include field: ${forbidden}`);
    }
  }
  ok("Queue message schema excludes secrets and payloads");

  const dispatchTs = readRepoFile("lib/queue/dispatch.ts");
  if (!dispatchTs.includes('.eq("tenant_id", tenantId)')) {
    fail("dispatchReplay must filter webhook_deliveries by tenant_id");
  }
  ok("Replay dispatch is tenant-scoped");

  const workerTs = readRepoFile("lib/queue/worker.ts");
  if (!workerTs.includes("PermanentJobError")) {
    fail("worker must define PermanentJobError for non-retryable jobs");
  }
  if (!workerTs.includes('status === "suspended"') && !workerTs.includes('tenantStatus === "suspended"')) {
    fail("worker must skip suspended tenants");
  }
  if (!workerTs.includes("evaluateEntitlement")) {
    fail("worker must skip tenants that are not billing-entitled");
  }
  ok("Worker drops unknown tenants and skips suspended/unentitled");

  const middleware = readRepoFile("middleware.ts");
  if (!middleware.includes('"/api/webhooks"')) {
    fail("middleware must allow public webhook paths");
  }
  ok("Middleware exposes public OAuth and webhook routes");

  const oauthTs = readRepoFile("lib/hubspot/oauth.ts");
  if (oauthTs.includes("oauth/v1/")) {
    fail("oauth.ts still calls HubSpot OAuth v1 endpoints");
  }
  if (!oauthTs.includes("oauth/2026-03/token")) {
    fail("oauth.ts must use oauth/2026-03/token");
  }
  ok("OAuth uses 2026-03 token and introspect endpoints");

  const oauthCallback = readRepoFile("app/api/oauth/hubspot/callback/route.ts");
  if (oauthCallback.includes("trial_ends_at")) {
    fail("OAuth callback must not start a no-card trial; trial starts at Stripe Checkout");
  }
  ok("HubSpot install does not grant a no-card trial");

  const checkoutTs = readRepoFile("lib/billing/checkout.ts");
  if (!checkoutTs.includes('payment_method_collection: "always"')) {
    fail("Checkout must require a card during trial");
  }
  if (!checkoutTs.includes("trial_period_days")) {
    fail("Checkout must pass Stripe trial_period_days");
  }
  ok("Stripe Checkout is a card-required trial");

  const stripeWebhook = readRepoFile("app/api/webhooks/stripe/route.ts");
  if (!stripeWebhook.includes("constructEvent")) {
    fail("Stripe webhook route must verify signatures");
  }
  ok("Stripe webhook signature verification is present");

  const hubspotWebhook = readRepoFile("app/api/webhooks/hubspot/route.ts");
  if (!hubspotWebhook.includes("cancelStripeForPortal")) {
    fail("HubSpot webhook must cancel Stripe on uninstall");
  }
  ok("HubSpot uninstall cancels Stripe");

  const uninstallTs = readRepoFile("lib/billing/uninstall.ts");
  if (!uninstallTs.includes("upsertBillingFromSubscription")) {
    fail("Uninstall must persist canceled Stripe status so sync stops immediately");
  }
  ok("HubSpot uninstall blocks entitlement immediately");

  for (const doc of [
    "docs/INFRA_ACCEPTANCE.md",
    "infra/sam/README.md",
    "app/terms/page.tsx",
    "app/setup-guide/page.tsx",
    "components/site-footer.tsx",
  ]) {
    if (!existsSync(join(process.cwd(), doc))) {
      fail(`Missing infrastructure doc or page: ${doc}`);
    }
  }
  ok("Acceptance doc, SAM readme, and marketplace pages present");
}

function loadDotEnvLocal(): Record<string, string> {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function runEnvChecks(): void {
  console.log("\n[env] Local environment (.env.local)");

  const env = loadDotEnvLocal();
  if (Object.keys(env).length === 0) {
    warn(".env.local not found — skip or create from deployment secrets");
    return;
  }

  for (const key of REQUIRED_APP_ENV) {
    if (!env[key]?.trim()) {
      fail(`Missing or empty in .env.local: ${key}`);
    }
    ok(key);
  }

  for (const key of MARKETPLACE_ENV) {
    if (!env[key]?.trim()) {
      warn(`Missing marketplace variable: ${key}`);
    } else {
      ok(key);
    }
  }

  if (env.SQS_QUEUE_URL?.trim()) {
    ok("SQS_QUEUE_URL is set (queue mode enabled locally)");
  } else {
    ok("SQS_QUEUE_URL unset (inline dispatch — expected for Vercel prod pre-cutover)");
  }
}

async function runUrlChecks(baseUrl: string): Promise<void> {
  console.log(`\n[urls] Public pages at ${baseUrl}`);

  const seen = new Set<string>();
  for (const path of PUBLIC_PATHS) {
    const url = `${baseUrl}${path}`;
    if (seen.has(url)) {
      fail(`Duplicate URL in check list: ${url}`);
    }
    seen.add(url);

    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "MethodData-InfraVerify/1.0" },
      });
    } catch (error) {
      fail(
        `Fetch failed for ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (res.status < 200 || res.status >= 300) {
      fail(`${path} returned HTTP ${res.status}`);
    }

    const html = await res.text();
    if (html.length < 200) {
      fail(`${path} body too short — likely empty or error page`);
    }

    ok(`${path} → HTTP ${res.status}`);
  }

  const termsHtml = await (await fetch(`${baseUrl}/terms`)).text();
  if (termsHtml.includes("Set NEXT_PUBLIC_SUPPORT_EMAIL")) {
    warn("/terms still shows support email placeholder — set NEXT_PUBLIC_SUPPORT_EMAIL on Vercel");
  }

  const privacyHtml = await (await fetch(`${baseUrl}/privacy`)).text();
  if (privacyHtml.includes("Set NEXT_PUBLIC_SUPPORT_EMAIL")) {
    warn("/privacy still shows support email placeholder");
  }
}

function awsCmd(args: string[], profile?: string): string {
  const fullArgs = profile ? [...args, "--profile", profile] : args;
  const result = spawnSync("aws", fullArgs, {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    fail(
      `aws ${fullArgs.join(" ")} failed: ${result.stderr?.trim() || result.stdout?.trim() || "unknown error"}`
    );
  }
  return (result.stdout ?? "").trim();
}

function runAwsChecks(profile: string | undefined, stackName: string): void {
  console.log(`\n[aws] Stack ${stackName}${profile ? ` (profile ${profile})` : ""}`);

  const stacksRaw = awsCmd(
    ["cloudformation", "describe-stacks", "--stack-name", stackName],
    profile
  );
  let stacks: { Stacks?: { StackStatus?: string }[] };
  try {
    stacks = JSON.parse(stacksRaw) as typeof stacks;
  } catch {
    fail("Could not parse CloudFormation describe-stacks output");
  }

  const status = stacks.Stacks?.[0]?.StackStatus;
  if (!status || !/^CREATE_COMPLETE|UPDATE_COMPLETE/.test(status)) {
    fail(`Stack status not healthy: ${status ?? "unknown"}`);
  }
  ok(`Stack status: ${status}`);

  const outputsRaw = awsCmd(
    [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      stackName,
      "--query",
      "Stacks[0].Outputs",
      "--output",
      "json",
    ],
    profile
  );
  const outputs = JSON.parse(outputsRaw) as { OutputKey?: string; OutputValue?: string }[];
  const queueUrl = outputs.find((o) => o.OutputKey === "JobQueueUrl")?.OutputValue;
  if (!queueUrl?.includes(DEFAULT_QUEUE_SUFFIX) && !queueUrl?.includes("-jobs")) {
    warn(`Unexpected JobQueueUrl: ${queueUrl ?? "missing"}`);
  } else {
    ok(`JobQueueUrl: ${queueUrl}`);
  }

  const dlqUrl = outputs.find((o) => o.OutputKey === "DeadLetterQueueUrl")?.OutputValue;
  if (dlqUrl) ok(`DeadLetterQueueUrl present`);

  const fnName = outputs.find((o) => o.OutputKey === "WorkerFunctionName")?.OutputValue;
  if (!fnName) {
    fail("WorkerFunctionName output missing");
  }
  ok(`WorkerFunctionName: ${fnName}`);

  const alarmsRaw = awsCmd(
    [
      "cloudwatch",
      "describe-alarms",
      "--alarm-name-prefix",
      stackName,
      "--output",
      "json",
    ],
    profile
  );
  const alarms = JSON.parse(alarmsRaw) as {
    MetricAlarms?: { AlarmName?: string }[];
  };
  if ((alarms.MetricAlarms?.length ?? 0) < 1) {
    fail("No CloudWatch alarms found for stack prefix");
  }
  ok(`CloudWatch alarms: ${alarms.MetricAlarms?.map((a) => a.AlarmName).join(", ")}`);
}

async function main(): Promise<void> {
  const { mode, baseUrl, profile, stackName } = parseArgs();
  const modes =
    mode === "all"
      ? (["static", "env", "urls", "aws"] as const)
      : ([mode] as const);

  console.log(`verify-infra mode=${mode}`);

  for (const m of modes) {
    if (m === "static") runStaticChecks();
    else if (m === "env") runEnvChecks();
    else if (m === "urls") await runUrlChecks(baseUrl);
    else if (m === "aws") runAwsChecks(profile, stackName);
  }

  console.log("\nverify-infra passed\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
