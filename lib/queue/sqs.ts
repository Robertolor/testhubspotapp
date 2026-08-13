import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { requireQueueConfig } from "@/lib/queue/config";
import {
  createQueueMessage,
  type QueueMessage,
} from "@/lib/queue/message";

let client: SQSClient | null = null;

function getSqsClient(): SQSClient {
  if (!client) {
    const { region } = requireQueueConfig();
    client = new SQSClient({ region });
  }
  return client;
}

/** Enqueue a tenant-stamped job. Body never includes credentials or webhook payloads. */
export async function enqueueJob(
  input: Omit<QueueMessage, "version" | "attempt" | "enqueuedAt" | "traceId"> & {
    attempt?: number;
    traceId?: string;
  }
): Promise<void> {
  const { queueUrl } = requireQueueConfig();
  const message = createQueueMessage(input);

  await getSqsClient().send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        tenantId: { DataType: "String", StringValue: message.tenantId },
        jobType: { DataType: "String", StringValue: message.jobType },
      },
    })
  );
}
