import { NextRequest, NextResponse } from "next/server";
import { runInBackground } from "@/lib/background";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import { getMindbodyAccountsBySite } from "@/lib/mindbody/client";
import { verifyMindbodyWebhook } from "@/lib/mindbody/webhook-verify";
import { dispatchProcessWebhook } from "@/lib/queue/dispatch";

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

async function signatureKeyForTenant(tenantId: string): Promise<string | null> {
  const { data: sub } = await getSupabase()
    .from("mindbody_webhook_subscriptions")
    .select("message_signature_key_encrypted")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!sub?.message_signature_key_encrypted) return null;
  return decryptSecret(sub.message_signature_key_encrypted);
}

async function tenantIdsForPayload(
  siteId: number,
  payload: Record<string, unknown>
): Promise<string[]> {
  const referenceId = String(payload.referenceId ?? "");
  const match = referenceId.match(/^tenant-(.+)$/);
  if (match?.[1]) return [match[1]];

  if (!siteId) return [];
  const accounts = await getMindbodyAccountsBySite(siteId);
  return accounts.map((account) => account.tenant_id);
}

async function enqueueDelivery(input: {
  tenantId: string;
  siteId: number;
  eventId: string;
  messageId: string;
  payload: Record<string, unknown>;
}): Promise<"queued" | "duplicate" | "failed"> {
  const idempotencyKey = `${input.tenantId}-${input.siteId}-${input.eventId}-${input.messageId}`;
  const { data: delivery, error } = await getSupabase()
    .from("webhook_deliveries")
    .insert({
      tenant_id: input.tenantId,
      source: "mindbody",
      idempotency_key: idempotencyKey,
      payload: input.payload as object,
      signature_valid: true,
      status: "queued",
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return "duplicate";
    return "failed";
  }

  runInBackground(
    dispatchProcessWebhook({
      tenantId: input.tenantId,
      source: "mindbody",
      deliveryId: delivery.id,
      payload: input.payload,
    })
  );
  return "queued";
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
    payload.siteId ??
      payload.siteID ??
      payload.locationId ??
      (payload.eventData as Record<string, unknown> | undefined)?.siteId ??
      0
  );

  const tenantIds = await tenantIdsForPayload(siteId, payload);
  if (tenantIds.length === 0) {
    console.warn("[mindbody-webhook] rejected: unknown tenant", {
      siteId,
      eventId: payload.eventId,
      hasReferenceId: Boolean(payload.referenceId),
    });
    return NextResponse.json(
      { error: "Unknown tenant or subscription" },
      { status: 404 }
    );
  }

  const eventId = String(payload.eventId ?? "unknown");
  const messageId = String(payload.messageId ?? payload.id ?? Date.now());

  let verified = 0;
  let queued = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    const signatureKey = await signatureKeyForTenant(tenantId);
    if (!signatureKey) continue;
    if (!verifyMindbodyWebhook(rawBody, signature, signatureKey)) continue;
    verified += 1;

    const result = await enqueueDelivery({
      tenantId,
      siteId,
      eventId,
      messageId,
      payload,
    });
    if (result === "failed") failed += 1;
    if (result === "queued") queued += 1;
  }

  if (verified === 0) {
    console.warn("[mindbody-webhook] rejected: invalid signature", {
      siteId,
      eventId: payload.eventId,
      messageId: payload.messageId,
      tenantCount: tenantIds.length,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (failed > 0 && queued === 0) {
    return NextResponse.json({ error: "Storage failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, queued });
}
