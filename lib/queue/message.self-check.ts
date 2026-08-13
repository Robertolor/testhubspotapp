import { createQueueMessage, parseQueueMessage } from "./message";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const webhook = createQueueMessage({
  tenantId: "11111111-1111-4111-8111-111111111111",
  jobType: "process_webhook",
  deliveryId: "22222222-2222-4222-8222-222222222222",
});

assert(webhook.version === 1, "version must be 1");
assert(webhook.tenantId.startsWith("11111111"), "tenantId must round-trip");
assert(webhook.deliveryId, "deliveryId required on webhook jobs");
assert(!("payload" in webhook), "payload must not be on the envelope");

const parsed = parseQueueMessage(JSON.parse(JSON.stringify(webhook)));
assert(parsed.traceId === webhook.traceId, "JSON round-trip must preserve traceId");

let rejectedMissingDelivery = false;
try {
  parseQueueMessage({
    version: 1,
    tenantId: "11111111-1111-4111-8111-111111111111",
    jobType: "process_webhook",
    attempt: 0,
    traceId: "trace",
    enqueuedAt: new Date().toISOString(),
  });
} catch {
  rejectedMissingDelivery = true;
}
assert(rejectedMissingDelivery, "webhook jobs without deliveryId must fail");

const backfill = createQueueMessage({
  tenantId: "11111111-1111-4111-8111-111111111111",
  jobType: "backfill",
  entityType: "contact",
});
assert(backfill.entityType === "contact", "backfill must carry entityType");

console.log("queue message self-check passed");
