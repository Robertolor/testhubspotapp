import { NextResponse } from "next/server";
import { getMindbodyAccountByTenant } from "@/lib/mindbody/client";
import type { MindbodyAccount } from "@/lib/db/types";

export function isMindbodyReadyForSync(
  account: MindbodyAccount | null | undefined
): boolean {
  if (!account) return false;
  return Boolean(
    account.site_id &&
      account.api_key_encrypted &&
      account.staff_username &&
      account.staff_password_encrypted
  );
}

export async function requireMindbodyConfigured(
  tenantId: string
): Promise<NextResponse | null> {
  const account = await getMindbodyAccountByTenant(tenantId);
  if (isMindbodyReadyForSync(account)) return null;

  return NextResponse.json(
    {
      error:
        "Mindbody is not connected yet. Save your Site ID, API key, and staff login first.",
      settingsPath: "/settings",
    },
    { status: 400 }
  );
}
