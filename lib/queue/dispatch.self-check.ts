import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getQueueConfig } from "./config";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const savedQueueUrl = process.env.SQS_QUEUE_URL;
const savedRegion = process.env.AWS_REGION;

try {
  delete process.env.SQS_QUEUE_URL;
  assert(!getQueueConfig().enabled, "queue must be disabled when SQS_QUEUE_URL unset");

  process.env.SQS_QUEUE_URL =
    "https://sqs.us-east-1.amazonaws.com/058264259194/hubspot-sync-sbx-jobs";
  process.env.AWS_REGION = "us-east-1";
  const enabled = getQueueConfig();
  assert(enabled.enabled, "queue must enable when SQS_QUEUE_URL is set");
  assert(enabled.queueUrl?.includes("sqs."), "queue URL must be preserved");
  assert(enabled.region === "us-east-1", "region must be read from AWS_REGION");
} finally {
  if (savedQueueUrl === undefined) delete process.env.SQS_QUEUE_URL;
  else process.env.SQS_QUEUE_URL = savedQueueUrl;
  if (savedRegion === undefined) delete process.env.AWS_REGION;
  else process.env.AWS_REGION = savedRegion;
}

const dispatchSource = readFileSync(
  join(process.cwd(), "lib/queue/dispatch.ts"),
  "utf8"
);
assert(
  dispatchSource.includes('.eq("tenant_id", tenantId)'),
  "dispatchReplay must scope webhook_deliveries by tenant_id"
);
assert(
  dispatchSource.includes("getQueueConfig().enabled"),
  "dispatch must branch on queue config for inline fallback"
);

console.log("dispatch self-check passed");
