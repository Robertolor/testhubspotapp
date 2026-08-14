import Link from "next/link";
import type { Metadata } from "next";
import { HUBSPOT_SCOPES } from "@/lib/hubspot/config";
import { getSupportEmail } from "@/lib/support";

export const metadata: Metadata = {
  title: "Setup Guide · Mindbody ↔ HubSpot Sync",
  description:
    "Install and configure Mindbody ↔ HubSpot Sync from the HubSpot Marketplace",
};

const scopeList = HUBSPOT_SCOPES.split(" ").filter((s) => s !== "oauth");

export default function SetupGuidePage() {
  const email = getSupportEmail();

  return (
    <div className="flex flex-1 bg-slate-50 px-6 py-12">
      <article className="mx-auto max-w-2xl space-y-10 text-slate-700">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Documentation
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Setup guide
          </h1>
          <p className="text-sm text-slate-500">Last updated: August 14, 2026</p>
          <p className="text-slate-600">
            This guide explains how to install, configure, use, disconnect, and
            uninstall <strong>Mindbody ↔ HubSpot Sync</strong> after installing
            it from the HubSpot Marketplace.
          </p>
        </header>

        <nav className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <p className="font-semibold text-slate-900">On this page</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              <a className="text-teal-700 hover:underline" href="#overview">
                What the app does
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#requirements">
                Before you start
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#install">
                Install the app
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#mindbody">
                Connect Mindbody
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#configure">
                Configure sync
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#use">
                Use the app
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#reports">
                Review sync results
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#disconnect">
                Disconnect Mindbody
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#uninstall">
                Uninstall from HubSpot
              </a>
            </li>
            <li>
              <a className="text-teal-700 hover:underline" href="#support">
                Get help
              </a>
            </li>
          </ol>
        </nav>

        <section id="overview" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            1. What the app does
          </h2>
          <p>
            Mindbody ↔ HubSpot Sync connects one Mindbody site to one HubSpot
            portal so you can keep CRM data aligned without manual exports.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Sync <strong>contacts</strong> between Mindbody clients and
              HubSpot contacts
            </li>
            <li>
              Sync <strong>deals</strong> from Mindbody sales, contracts,
              appointments, and visits
            </li>
            <li>
              Optionally sync <strong>line items</strong> onto HubSpot deals
            </li>
            <li>Map fields and deal pipeline stages per portal</li>
            <li>Run small test syncs or larger full syncs from Settings</li>
            <li>Review runs and errors in Reports</li>
          </ul>
          <p className="text-sm text-slate-600">
            The primary supported path today is{" "}
            <strong>Mindbody → HubSpot</strong>. Ongoing updates can also arrive
            via webhooks when Mindbody Push is active for your site. Some
            Mindbody sandbox sites do not emit webhooks reliably — use the small
            sync in Settings to validate mappings first.
          </p>
        </section>

        <section id="requirements" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            2. Before you start
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              A HubSpot account where you can install marketplace apps (Super
              admin or a user with app install permissions)
            </li>
            <li>
              A Mindbody site with API access — Site ID, site API key, and a
              staff login allowed to use the API
            </li>
            <li>
              Your Mindbody credentials ready before opening Settings
            </li>
          </ul>
          <p>
            During install, HubSpot will show the OAuth scopes the app requests.
            You can review them on the approval screen before connecting.
          </p>
        </section>

        <section id="install" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            3. Install the app
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Open the app listing in the{" "}
              <a
                className="font-medium text-teal-700 hover:underline"
                href="https://ecosystem.hubspot.com/marketplace/apps"
                rel="noopener noreferrer"
                target="_blank"
              >
                HubSpot Marketplace
              </a>{" "}
              and click <strong>Install app</strong>, or go directly to{" "}
              <Link
                className="font-medium text-teal-700 hover:underline"
                href="/api/oauth/hubspot"
              >
                Install with HubSpot
              </Link>
              .
            </li>
            <li>
              Sign in to HubSpot if prompted and choose the portal you want to
              connect.
            </li>
            <li>
              Review the requested permissions on HubSpot&apos;s scope approval
              screen, then click <strong>Connect app</strong>.
            </li>
            <li>
              After authorization, you are redirected to the app&apos;s{" "}
              <strong>Setup</strong> page (<code>/setup</code>).
            </li>
          </ol>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p className="font-medium text-slate-900">HubSpot scopes requested</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
              {scopeList.map((scope) => (
                <li key={scope}>
                  <code className="text-xs">{scope}</code>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="mindbody" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            4. Connect Mindbody
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              From the Setup page, open <strong>Settings</strong> (
              <code>/settings</code>).
            </li>
            <li>
              In the Mindbody connection section, enter:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>Site ID</strong> — your Mindbody site number
                </li>
                <li>
                  <strong>API key</strong> — from your Mindbody developer /
                  business settings
                </li>
                <li>
                  <strong>Staff email</strong> and{" "}
                  <strong>staff password</strong> — a staff account with API
                  access
                </li>
              </ul>
            </li>
            <li>
              Click <strong>Save connection</strong>. The app tests the
              connection and registers Mindbody webhooks automatically when
              possible.
            </li>
            <li>
              When connected, the page shows your site ID and staff email. Use{" "}
              <strong>Update connection</strong> later if credentials change.
            </li>
          </ol>
          <p className="text-sm text-slate-600">
            You do not need to manually create webhook subscriptions in
            Mindbody&apos;s admin UI — the app handles that after you save valid
            credentials.
          </p>
        </section>

        <section id="configure" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            5. Configure sync
          </h2>

          <h3 className="font-medium text-slate-900">What to sync</h3>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Enable <strong>Contacts</strong> and/or{" "}
              <strong>Deals (memberships &amp; purchases)</strong>.
            </li>
            <li>
              Choose sync direction. For most studios, start with{" "}
              <strong>Mindbody → HubSpot</strong>.
            </li>
            <li>
              Pick the HubSpot deal pipeline and map Mindbody deal types to
              pipeline stages when syncing deals.
            </li>
            <li>
              Click <strong>Save what to sync</strong>.
            </li>
          </ol>

          <h3 className="font-medium text-slate-900">Filters (optional)</h3>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Skip purchases below</strong> — ignore small purchases
            </li>
            <li>
              <strong>Only sync from this date</strong> — limit historical
              Mindbody records (recommended to control API usage)
            </li>
            <li>
              <strong>Move the cutoff forward after each sync</strong> — after a
              successful sync, advance the cutoff to today
            </li>
            <li>
              Extra record types: appointments, visits, line items, and record
              link options
            </li>
          </ul>
          <p>Click <strong>Save filters</strong> when done.</p>

          <h3 className="font-medium text-slate-900">Field mappings (optional)</h3>
          <p>
            Open <strong>Mappings</strong> (<code>/settings/mappings</code>) to
            map Mindbody fields to HubSpot contact and deal properties. Save
            each entity section after editing.
          </p>
        </section>

        <section id="use" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            6. Use the app
          </h2>

          <h3 className="font-medium text-slate-900">Manual sync (recommended first)</h3>
          <p>In Settings, use <strong>Try a small sync</strong>:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Sync 20 contacts</strong> — copies up to 20 Mindbody
              clients into HubSpot
            </li>
            <li>
              <strong>Sync 20 deals</strong> — copies up to 20 deals (run
              contacts and deals separately, not at the same time)
            </li>
          </ul>
          <p>
            Open <strong>Reports</strong> to watch progress and confirm results
            before relying on live traffic.
          </p>

          <h3 className="font-medium text-slate-900">Full sync (advanced)</h3>
          <p>
            Expand <strong>Advanced: sync everything</strong> in Settings to run{" "}
            <strong>Sync all contacts</strong> or <strong>Sync all deals</strong>
            . This can take longer and uses more Mindbody API quota. Start with
            the small sync and a cutoff date.
          </p>

          <h3 className="font-medium text-slate-900">Automatic sync (webhooks)</h3>
          <p>
            After HubSpot install and Mindbody connection, the app registers
            webhooks on both sides when supported. New or updated Mindbody
            clients, sales, and contracts can sync into HubSpot without manual
            action. Webhook delivery depends on your Mindbody site type and
            activation status.
          </p>
        </section>

        <section id="reports" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            7. Review sync results
          </h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open <strong>Reports</strong> (<code>/reports</code>) from the app
              navigation.
            </li>
            <li>
              Select a run to see status (success, partial, failed), event
              counts, and individual record outcomes.
            </li>
            <li>
              Fix mapping or credential issues in Settings, then run another
              small sync to verify.
            </li>
          </ol>
        </section>

        <section id="disconnect" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            8. Disconnect Mindbody
          </h2>
          <p>To stop syncing from Mindbody without uninstalling the HubSpot app:</p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open <strong>Settings</strong>.</li>
            <li>
              Turn off <strong>Contacts</strong> and <strong>Deals</strong> in
              What to sync, then save.
            </li>
            <li>
              Optionally click <strong>Update connection</strong> and remove or
              replace stored Mindbody credentials.
            </li>
          </ol>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Note:</strong> Disconnecting stops new syncs. Records already
            created or updated in HubSpot remain in your portal. The app may
            retain connection metadata and sync logs for troubleshooting until
            you request deletion — see our{" "}
            <Link href="/privacy" className="font-medium text-teal-800 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section id="uninstall" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            9. Uninstall from HubSpot
          </h2>
          <p>
            To fully remove the integration from your HubSpot account, uninstall
            the app from HubSpot. This revokes OAuth access to your portal.
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              In HubSpot, go to <strong>Settings</strong> →{" "}
              <strong>Integrations</strong> → <strong>Connected apps</strong>.
            </li>
            <li>
              Find <strong>Mindbody ↔ HubSpot Sync</strong> and choose{" "}
              <strong>Uninstall</strong>.
            </li>
          </ol>
          <p>
            HubSpot&apos;s help article:{" "}
            <a
              className="font-medium text-teal-700 hover:underline"
              href="https://knowledge.hubspot.com/integrations/connect-apps-to-hubspot#uninstall-an-app"
              rel="noopener noreferrer"
              target="_blank"
            >
              Connect apps to HubSpot — uninstall an app
            </a>
            .
          </p>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>What happens to your data:</strong> Uninstalling revokes
            HubSpot API access immediately. Existing HubSpot contacts and deals
            are not automatically deleted. To request deletion of data stored
            by the app (tokens, Mindbody credentials, sync logs), contact
            support after uninstalling.
          </p>
        </section>

        <section id="support" className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">10. Get help</h2>
          <p>
            Email{" "}
            {email ? (
              <a
                className="font-medium text-teal-700 hover:underline"
                href={`mailto:${email}`}
              >
                {email}
              </a>
            ) : (
              <span className="font-medium text-slate-900">
                via the Support link in the site footer
              </span>
            )}
            . See also Setup guide, Privacy, and Terms in the footer.
          </p>
        </section>

        <p className="border-t border-slate-200 pt-6 text-sm">
          <Link href="/" className="text-teal-700 hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
