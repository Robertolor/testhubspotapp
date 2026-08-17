import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const source = readFileSync(join(process.cwd(), "lib/hubspot/oauth.ts"), "utf8");

assert(
  !source.includes("oauth/v1/"),
  "oauth.ts must not call HubSpot OAuth v1 endpoints"
);
assert(
  source.includes("https://api.hubapi.com/oauth/2026-03/token"),
  "oauth.ts must exchange and refresh tokens at oauth/2026-03/token"
);
assert(
  source.includes("https://api.hubapi.com/oauth/2026-03/token/introspect"),
  "oauth.ts must introspect tokens at oauth/2026-03/token/introspect"
);
assert(
  source.includes("token_type_hint"),
  "introspect requests must include token_type_hint"
);

console.log("oauth self-check passed");
