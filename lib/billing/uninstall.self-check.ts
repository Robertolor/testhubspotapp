import { isHubspotUninstallEvent } from "./uninstall";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  isHubspotUninstallEvent({ subscriptionType: "app.uninstall", portalId: 1 }),
  "app.uninstall is an uninstall event"
);
assert(
  isHubspotUninstallEvent({ eventType: "uninstall" }),
  "eventType uninstall is recognized"
);
assert(
  !isHubspotUninstallEvent({ subscriptionType: "contact.creation" }),
  "CRM events are not uninstalls"
);

console.log("billing uninstall self-check passed");
