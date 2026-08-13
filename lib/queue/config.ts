/**
 * Queue env for the Next.js ingress app (Vercel / local).
 * When SQS_QUEUE_URL is set, dispatch sends tenant-stamped jobs to SQS.
 * When unset, dispatch runs inline (local/dev).
 */
export function getQueueConfig(): {
  enabled: boolean;
  queueUrl: string | undefined;
  region: string | undefined;
} {
  const queueUrl = process.env.SQS_QUEUE_URL?.trim() || undefined;
  const region =
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    undefined;

  return {
    enabled: Boolean(queueUrl),
    queueUrl,
    region,
  };
}

export function requireQueueConfig(): {
  enabled: true;
  queueUrl: string;
  region: string;
} {
  const config = getQueueConfig();
  if (!config.queueUrl) {
    throw new Error("SQS_QUEUE_URL is required when the SQS worker is enabled");
  }
  if (!config.region) {
    throw new Error("AWS_REGION is required when the SQS worker is enabled");
  }
  return {
    enabled: true,
    queueUrl: config.queueUrl,
    region: config.region,
  };
}
