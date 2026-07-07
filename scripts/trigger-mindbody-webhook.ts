/**
 * Local sandbox helper — trigger Mindbody webhooks without the Mindbody UI.
 *
 * Setup: add to .env.local (same values as production Settings, NOT the developer key):
 *   MINDBODY_SANDBOX_SITE_ID=-99
 *   MINDBODY_SANDBOX_API_KEY=your-site-api-key
 *   MINDBODY_SANDBOX_STAFF_USERNAME=mindbodysandboxsite@gmail.com
 *   MINDBODY_SANDBOX_STAFF_PASSWORD=your-staff-password
 *
 * Usage:
 *   npm run mindbody:webhook-test -- list
 *   npm run mindbody:webhook-test -- touch <clientId>
 *   npm run mindbody:webhook-test -- create
 *
 * Then check Supabase webhook_deliveries and app Reports.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { MINDBODY_PUBLIC_API } from "../lib/mindbody/config";

interface MindbodyClient {
  Id: string;
  UniqueId?: number;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  MobilePhone?: string;
  BirthDate?: string;
}

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to .env.local (see scripts/trigger-mindbody-webhook.ts header).`
    );
  }
  return value;
}

function sandboxConfig() {
  return {
    siteId: Number(requireEnv("MINDBODY_SANDBOX_SITE_ID")),
    apiKey: requireEnv("MINDBODY_SANDBOX_API_KEY"),
    staffUsername: requireEnv("MINDBODY_SANDBOX_STAFF_USERNAME"),
    staffPassword: requireEnv("MINDBODY_SANDBOX_STAFF_PASSWORD"),
  };
}

async function issueStaffToken(
  siteId: number,
  apiKey: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(`${MINDBODY_PUBLIC_API}/usertoken/issue`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      SiteId: String(siteId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Username: username, Password: password }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Staff token failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { AccessToken: string };
  return data.AccessToken;
}

async function mindbodyFetch(
  siteId: number,
  apiKey: string,
  token: string,
  method: string,
  path: string,
  options?: { query?: Record<string, string>; body?: unknown }
): Promise<Response> {
  const url = new URL(`${MINDBODY_PUBLIC_API}${path}`);
  if (options?.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  return fetch(url.toString(), {
    method,
    headers: {
      "Api-Key": apiKey,
      SiteId: String(siteId),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
}

async function listClients(
  siteId: number,
  apiKey: string,
  token: string,
  limit = 10
): Promise<MindbodyClient[]> {
  const res = await mindbodyFetch(siteId, apiKey, token, "GET", "/client/clients", {
    query: { Limit: String(limit), Offset: "0" },
  });
  if (!res.ok) {
    throw new Error(`List clients failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { Clients?: MindbodyClient[] };
  return data.Clients ?? [];
}

async function getClient(
  siteId: number,
  apiKey: string,
  token: string,
  clientId: string
): Promise<MindbodyClient | null> {
  const res = await mindbodyFetch(siteId, apiKey, token, "GET", "/client/clients", {
    query: { ClientIds: clientId },
  });
  if (!res.ok) {
    throw new Error(`Get client failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { Clients?: MindbodyClient[] };
  return data.Clients?.[0] ?? null;
}

function bumpPhone(phone: string | undefined): string {
  const base = (phone ?? "5550000000").replace(/\D/g, "");
  const suffix = String(Date.now()).slice(-4);
  return `${base.slice(0, 6)}${suffix}`.slice(0, 15);
}

async function touchClient(
  siteId: number,
  apiKey: string,
  token: string,
  clientId: string
): Promise<void> {
  const existing = await getClient(siteId, apiKey, token, clientId);
  if (!existing) {
    throw new Error(`Client ${clientId} not found in sandbox`);
  }
  if (!existing.Email) {
    throw new Error(`Client ${clientId} has no email; pick another client`);
  }

  const nextPhone = bumpPhone(existing.MobilePhone);

  const res = await mindbodyFetch(siteId, apiKey, token, "POST", "/client/updateclient", {
    body: {
      Client: {
        Id: existing.Id,
        FirstName: existing.FirstName ?? "Test",
        LastName: existing.LastName ?? "Client",
        Email: existing.Email,
        MobilePhone: nextPhone,
        BirthDate: existing.BirthDate ?? "1990-01-01T00:00:00",
      },
      CrossRegionalUpdate: false,
      Test: false,
    },
  });

  if (!res.ok) {
    throw new Error(`Update client failed: ${await res.text()}`);
  }

  console.log(`Updated client ${existing.Id} (${existing.Email})`);
  console.log(`  MobilePhone: ${existing.MobilePhone ?? "(empty)"} → ${nextPhone}`);
  console.log("Expected webhook: client.updated");
}

async function createClient(
  siteId: number,
  apiKey: string,
  token: string
): Promise<void> {
  const stamp = Date.now();
  const email = `webhook-test+${stamp}@example.com`;

  const res = await mindbodyFetch(siteId, apiKey, token, "POST", "/client/addclient", {
    body: {
      FirstName: "Webhook",
      LastName: `Test${String(stamp).slice(-4)}`,
      Email: email,
      MobilePhone: bumpPhone(undefined),
      BirthDate: "1990-01-01T00:00:00",
    },
  });

  if (!res.ok) {
    throw new Error(`Create client failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { Client?: { Id: string } };
  console.log(`Created client ${data.Client?.Id ?? "(unknown id)"} (${email})`);
  console.log("Expected webhook: client.created");
}

function printUsage(): void {
  console.log(`
Mindbody sandbox webhook trigger

  npm run mindbody:webhook-test -- list
  npm run mindbody:webhook-test -- touch <clientId>
  npm run mindbody:webhook-test -- create

Requires MINDBODY_SANDBOX_* vars in .env.local
`);
}

async function main(): Promise<void> {
  loadEnvLocal();

  const [command, arg] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    printUsage();
    return;
  }

  const { siteId, apiKey, staffUsername, staffPassword } = sandboxConfig();
  console.log(`Mindbody sandbox site ${siteId}`);

  const token = await issueStaffToken(
    siteId,
    apiKey,
    staffUsername,
    staffPassword
  );
  console.log("Staff token issued.\n");

  if (command === "list") {
    const clients = await listClients(siteId, apiKey, token);
    if (clients.length === 0) {
      console.log("No clients returned. Try offset/limit or check credentials.");
      return;
    }
    console.log("ID        Email                          Name");
    console.log("--------  -----------------------------  --------------------");
    for (const client of clients) {
      const id = client.Id.padEnd(8);
      const email = (client.Email ?? "(no email)").padEnd(29).slice(0, 29);
      const name = `${client.FirstName ?? ""} ${client.LastName ?? ""}`.trim();
      console.log(`${id}  ${email}  ${name}`);
    }
    console.log("\nRun: npm run mindbody:webhook-test -- touch <clientId>");
    return;
  }

  if (command === "touch") {
    if (!arg) {
      throw new Error("Provide a client ID. Run list first.");
    }
    await touchClient(siteId, apiKey, token, arg);
  } else if (command === "create") {
    await createClient(siteId, apiKey, token);
  } else {
    printUsage();
    process.exitCode = 1;
    return;
  }

  console.log("\nNext: check Supabase webhook_deliveries and app Reports (within ~2 min).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
