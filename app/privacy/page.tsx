import Link from "next/link";
import type { Metadata } from "next";
import { getSupportEmail } from "@/lib/support";

export const metadata: Metadata = {
  title: "Privacy Policy · Mindbody ↔ HubSpot Sync",
  description:
    "Privacy policy for the Mindbody ↔ HubSpot Sync HubSpot marketplace app",
};

export default function PrivacyPage() {
  const email = getSupportEmail();

  return (
    <div className="flex flex-1 bg-slate-50 px-6 py-12">
      <article className="mx-auto max-w-2xl space-y-8 text-slate-700">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500">Last updated: July 21, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
          <p>
            Mindbody ↔ HubSpot Sync (&quot;the App&quot;) is a HubSpot marketplace
            application that helps businesses synchronize contact and deal data
            between Mindbody and HubSpot. This policy describes what information
            we process when you install and use the App.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Information we process
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>HubSpot account data:</strong> portal ID, OAuth tokens, and
              CRM records you choose to sync (for example contacts, deals, and
              line items), including mapped custom properties.
            </li>
            <li>
              <strong>Mindbody account data:</strong> site ID and credentials you
              provide, plus client, sale, contract, appointment, and visit data
              needed for sync.
            </li>
            <li>
              <strong>Operational logs:</strong> sync run status, errors, and
              webhook delivery metadata used to operate and troubleshoot the App.
            </li>
            <li>
              <strong>Session data:</strong> a signed session cookie so you can
              access your tenant dashboard after HubSpot install.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            How we use information
          </h2>
          <p>We use this information only to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Authenticate your HubSpot and Mindbody connections</li>
            <li>Perform the syncs and mappings you configure</li>
            <li>Show reports and diagnose sync failures</li>
            <li>Maintain security, prevent abuse, and improve reliability</li>
          </ul>
          <p>
            We do not sell customer personal data. We do not use synced CRM or
            Mindbody records for advertising.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Storage and security
          </h2>
          <p>
            Connection secrets (OAuth tokens, API keys, staff passwords, webhook
            signature keys) are encrypted at rest. Data is stored in our
            application database and processed on our hosting provider. Access is
            limited to operating the App for your tenant.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Third-party services
          </h2>
          <p>
            The App exchanges data with HubSpot and Mindbody under your
            authorization. Hosting and database providers process data on our
            behalf to run the App. Their use of data is governed by their own
            terms and privacy policies, in addition to this policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Retention</h2>
          <p>
            We retain connection and sync data while your installation remains
            active and for a reasonable period afterward for security, billing,
            and dispute resolution. You may request deletion of your tenant data
            by contacting support.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Uninstall the HubSpot app to revoke HubSpot OAuth access</li>
            <li>Remove or update Mindbody credentials in Settings</li>
            <li>Disable sync types or directions in Settings</li>
            <li>Contact support to request export or deletion of tenant data</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Privacy and support requests:{" "}
            {email ? (
              <a
                className="font-medium text-teal-700 hover:underline"
                href={`mailto:${email}`}
              >
                {email}
              </a>
            ) : (
              <span className="font-medium text-slate-900">
                use the Support link in the site footer after install
              </span>
            )}
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
