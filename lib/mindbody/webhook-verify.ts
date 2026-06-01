import { createHmac, timingSafeEqual } from "crypto";

export function verifyMindbodyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  messageSignatureKey: string
): boolean {
  if (!signatureHeader) return false;

  const hmac = createHmac("sha256", messageSignatureKey);
  hmac.update(rawBody, "utf8");
  const computed = `sha256=${hmac.digest("base64")}`;

  try {
    const a = Buffer.from(computed);
    const b = Buffer.from(signatureHeader);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
