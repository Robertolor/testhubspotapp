import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dispatchReplay } from "@/lib/queue/dispatch";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { deliveryId } = (await request.json()) as { deliveryId: string };
  if (!deliveryId) {
    return NextResponse.json({ error: "deliveryId required" }, { status: 400 });
  }

  try {
    await dispatchReplay(tenantId, deliveryId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replay failed";
    const status = message === "Delivery not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ ok: true });
}
