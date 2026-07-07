import { createHmac, timingSafeEqual } from "crypto";

function computeSignature(
  rawBody: string,
  messageSignatureKey: string | Buffer
): string {
  const hmac = createHmac("sha256", messageSignatureKey);
  hmac.update(rawBody, "utf8");
  return `sha256=${hmac.digest("base64")}`;
}

function signaturesMatch(expected: string, received: string): boolean {
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(received.trim());
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyMindbodyWebhook(
  rawBody: string,
  signatureHeader: string | null,
  messageSignatureKey: string
): boolean {
  if (!signatureHeader) return false;

  const keyCandidates: Array<string | Buffer> = [messageSignatureKey];
  try {
    keyCandidates.push(Buffer.from(messageSignatureKey, "base64"));
  } catch {
    // ignore invalid base64 keys
  }

  for (const key of keyCandidates) {
    const computed = computeSignature(rawBody, key);
    if (signaturesMatch(computed, signatureHeader)) {
      return true;
    }
  }

  return false;
}
