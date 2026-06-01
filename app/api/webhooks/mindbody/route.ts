import { NextRequest, NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import { getMindbodyAccountBySite } from "@/lib/mindbody/client";
import { verifyMindbodyWebhook } from "@/lib/mindbody/webhook-verify";
import { dispatchProcessWebhook } from "@/lib/inngest/dispatch";

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-mindbody-signature");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const siteId = Number(
    payload.siteId ?? payload.siteID ?? payload.locationId ?? 0
  );

  let tenantId: string | null = null;
  let signatureKey: string | null = null;

  if (siteId) {
    const account = await getMindbodyAccountBySite(siteId);
    if (account) {
      tenantId = account.tenant_id;
      const { data: sub } = await getSupabase()
        .from("mindbody_webhook_subscriptions")
        .select("message_signature_key_encrypted")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (sub?.message_signature_key_encrypted) {
        signatureKey = decryptSecret(sub.message_signature_key_encrypted);
      }
    }
  }

  if (!tenantId) {
    const referenceId = String(payload.referenceId ?? "");
    const match = referenceId.match(/^tenant-(.+)$/);
    if (match) {
      tenantId = match[1];
      const { data: sub } = await getSupabase()
        .from("mindbody_webhook_subscriptions")
        .select("message_signature_key_encrypted")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (sub?.message_signature_key_encrypted) {
        signatureKey = decryptSecret(sub.message_signature_key_encrypted);
      }
    }
  }

  if (!tenantId || !signatureKey) {
    return NextResponse.json(
      { error: "Unknown tenant or subscription" },
      { status: 404 }
    );
  }

  const valid = verifyMindbodyWebhook(rawBody, signature, signatureKey);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventId = String(payload.eventId ?? "unknown");
  const messageId = String(payload.messageId ?? payload.id ?? Date.now());
  const idempotencyKey = `${siteId}-${eventId}-${messageId}`;

  const { data: delivery, error } = await getSupabase()
    .from("webhook_deliveries")
    .insert({
      tenant_id: tenantId,
      source: "mindbody",
      idempotency_key: idempotencyKey,
      payload: payload as object,
      signature_valid: true,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  await dispatchProcessWebhook({
    tenantId,
    source: "mindbody",
    deliveryId: delivery.id,
    payload,
  });

  return NextResponse.json({ ok: true });
}
