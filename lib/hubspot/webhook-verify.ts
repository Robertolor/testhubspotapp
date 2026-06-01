import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getHubspotClientSecret } from "@/lib/hubspot/config";

const MAX_AGE_MS = 5 * 60 * 1000;

export interface HubspotWebhookVerifyInput {
  method: string;
  url: string;
  rawBody: string;
  signatureV3: string | null;
  timestamp: string | null;
}

export function verifyHubspotWebhookV3(
  input: HubspotWebhookVerifyInput
): boolean {
  const { signatureV3, timestamp, method, url, rawBody } = input;
  if (!signatureV3 || !timestamp) return false;

  const ts = Number(timestamp);
  if (Number.isNaN(ts)) return false;
  const requestTime = ts > 1e12 ? ts : ts * 1000;
  if (Math.abs(Date.now() - requestTime) > MAX_AGE_MS) return false;

  const source = `${method}${url}${rawBody}${timestamp}`;
  const hash = createHmac("sha256", getHubspotClientSecret())
    .update(source, "utf8")
    .digest("base64");

  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(signatureV3);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Legacy v1 signature for CRM webhook batches */
export function verifyHubspotWebhookV1(
  rawBody: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const hash = createHash("sha256")
    .update(getHubspotClientSecret() + rawBody)
    .digest("hex");
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
