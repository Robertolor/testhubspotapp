import { z } from "zod";

/** Jobs the shared SQS worker understands. Payload/secrets stay in Supabase. */
export const QUEUE_JOB_TYPES = [
  "process_webhook",
  "backfill",
  "test_sync",
  "replay_webhook",
] as const;

export type QueueJobType = (typeof QUEUE_JOB_TYPES)[number];

export const QUEUE_ENTITY_TYPES = ["contact", "deal", "line_item"] as const;
export type QueueEntityType = (typeof QUEUE_ENTITY_TYPES)[number];

export const QUEUE_MESSAGE_VERSION = 1 as const;

/**
 * SQS body. Identifies which tenant and which outbox row to process.
 * Never include HubSpot/Mindbody tokens, API keys, or webhook payloads here.
 */
export const queueMessageSchema = z
  .object({
    version: z.literal(QUEUE_MESSAGE_VERSION),
    tenantId: z.string().uuid(),
    jobType: z.enum(QUEUE_JOB_TYPES),
    deliveryId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    entityType: z.enum(QUEUE_ENTITY_TYPES).optional(),
    attempt: z.number().int().min(0).default(0),
    traceId: z.string().min(1),
    enqueuedAt: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.jobType === "process_webhook" || value.jobType === "replay_webhook") &&
      !value.deliveryId
    ) {
      ctx.addIssue({
        code: "custom",
        message: "deliveryId is required for webhook jobs",
        path: ["deliveryId"],
      });
    }

    if (
      (value.jobType === "backfill" || value.jobType === "test_sync") &&
      !value.entityType
    ) {
      ctx.addIssue({
        code: "custom",
        message: "entityType is required for backfill and test_sync jobs",
        path: ["entityType"],
      });
    }
  });

export type QueueMessage = z.infer<typeof queueMessageSchema>;

export function parseQueueMessage(input: unknown): QueueMessage {
  return queueMessageSchema.parse(input);
}

export function createQueueMessage(
  input: Omit<QueueMessage, "version" | "attempt" | "enqueuedAt" | "traceId"> & {
    attempt?: number;
    traceId?: string;
    enqueuedAt?: string;
  }
): QueueMessage {
  return parseQueueMessage({
    version: QUEUE_MESSAGE_VERSION,
    attempt: input.attempt ?? 0,
    traceId: input.traceId ?? crypto.randomUUID(),
    enqueuedAt: input.enqueuedAt ?? new Date().toISOString(),
    ...input,
  });
}
