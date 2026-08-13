import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/client";
import { getHubspotAccountByPortal } from "@/lib/hubspot/tokens";
import {
  verifyHubspotWebhookV1,
  verifyHubspotWebhookV3,
} from "@/lib/hubspot/webhook-verify";
import { dispatchProcessWebhook } from "@/lib/queue/dispatch";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const url = request.url;
  const signatureV3 = request.headers.get("x-hubspot-signature-v3");
  const timestamp = request.headers.get("x-hubspot-request-timestamp");
  const signatureV1 = request.headers.get("x-hubspot-signature");

  const v3Valid = verifyHubspotWebhookV3({
    method: "POST",
    url,
    rawBody,
    signatureV3,
    timestamp,
  });

  const v1Valid =
    !v3Valid &&
    verifyHubspotWebhookV1(rawBody, signatureV1);

  if (!v3Valid && !v1Valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = Array.isArray(payload) ? payload : [payload];
  const portalId = Number(
    (events[0] as Record<string, unknown>)?.portalId ?? 0
  );

  if (!portalId) {
    return NextResponse.json({ error: "Missing portalId" }, { status: 400 });
  }

  const account = await getHubspotAccountByPortal(portalId);
  if (!account) {
    return NextResponse.json({ error: "Unknown portal" }, { status: 404 });
  }

  const idempotencyKey = events
    .map((e) => {
      const ev = e as Record<string, unknown>;
      return `${ev.eventId ?? ev.subscriptionType}-${ev.objectId}-${ev.occurredAt ?? ev.attemptNumber}`;
    })
    .join("|");

  const { data: delivery, error } = await getSupabase()
    .from("webhook_deliveries")
    .insert({
      tenant_id: account.tenant_id,
      source: "hubspot",
      idempotency_key: idempotencyKey.slice(0, 500),
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
    tenantId: account.tenant_id,
    source: "hubspot",
    deliveryId: delivery.id,
    payload,
  });

  return NextResponse.json({ ok: true });
}
