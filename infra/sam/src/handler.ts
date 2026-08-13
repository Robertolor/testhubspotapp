import { parseQueueMessage } from "../../../lib/queue/message";
import {
  PermanentJobError,
  processQueueMessage,
} from "../../../lib/queue/worker";

type SqsRecord = {
  messageId: string;
  body: string;
};

type SqsEvent = {
  Records: SqsRecord[];
};

/**
 * Shared worker: one Standard queue, many tenants.
 * Each record is processed with that message's tenantId only.
 */
export async function handler(event: SqsEvent): Promise<{
  batchItemFailures: Array<{ itemIdentifier: string }>;
}> {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      const message = parseQueueMessage(JSON.parse(record.body) as unknown);
      console.log(
        JSON.stringify({
          level: "info",
          msg: "queue_message_received",
          tenantId: message.tenantId,
          jobType: message.jobType,
          deliveryId: message.deliveryId ?? null,
          jobId: message.jobId ?? null,
          entityType: message.entityType ?? null,
          traceId: message.traceId,
          attempt: message.attempt,
        })
      );
      await processQueueMessage(message);
      console.log(
        JSON.stringify({
          level: "info",
          msg: "queue_message_processed",
          tenantId: message.tenantId,
          jobType: message.jobType,
          traceId: message.traceId,
        })
      );
    } catch (error) {
      const permanent = error instanceof PermanentJobError;
      console.error(
        JSON.stringify({
          level: permanent ? "warn" : "error",
          msg: permanent ? "queue_message_dropped" : "queue_message_failed",
          messageId: record.messageId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      if (!permanent) {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }
  }

  return { batchItemFailures };
}
