import Link from "next/link";
import type { Metadata } from "next";
import { getSupportEmail } from "@/lib/support";

export const metadata: Metadata = {
  title: "Terms of Service · Mindbody ↔ HubSpot Sync",
  description:
    "Terms of Service for the Mindbody ↔ HubSpot Sync HubSpot marketplace app",
};

export default function TermsPage() {
  const email = getSupportEmail();

  return (
    <div className="flex flex-1 bg-slate-50 px-6 py-12">
      <article className="mx-auto max-w-2xl space-y-8 text-slate-700">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-hs-link">
            Legal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="text-sm text-slate-500">Last updated: August 14, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Agreement</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and
            use of Mindbody ↔ HubSpot Sync (&quot;the App&quot;), a software
            integration operated by MethodData (&quot;we,&quot; &quot;us,&quot;
            or &quot;our&quot;). By installing the App, connecting your accounts,
            or using any part of the service, you agree to these Terms and to
            our{" "}
            <Link href="/privacy" className="font-medium text-hs-link hover:underline">
              Privacy Policy
            </Link>
            , which is incorporated by reference.
          </p>
          <p>
            If you are using the App on behalf of a company or other organization,
            you represent that you have authority to bind that organization, and
            &quot;you&quot; refers to that organization.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            What the App does
          </h2>
          <p>
            The App helps businesses synchronize contact and deal data between
            Mindbody and HubSpot according to the settings you configure. Features
            may include OAuth-based HubSpot installation, Mindbody credential
            connection, field and pipeline mappings, manual test sync, full sync,
            webhook-driven updates, and sync reporting.
          </p>
          <p>
            Available features, sync directions, and supported record types may
            change over time. We may add, modify, or remove functionality with
            reasonable notice when practicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Third-party services
          </h2>
          <p>
            The App integrates with HubSpot and Mindbody. Those platforms are
            operated by third parties and are subject to their own terms,
            privacy policies, and acceptable use rules. We do not control
            HubSpot or Mindbody and are not responsible for their availability,
            API changes, rate limits, outages, or data handling.
          </p>
          <p>
            HubSpot is a trademark of HubSpot, Inc. Mindbody is a trademark of
            Mindbody, Inc. We are not affiliated with, sponsored by, or endorsed
            by HubSpot or Mindbody. Your use of the App from the HubSpot
            Marketplace is also subject to{" "}
            <a
              className="font-medium text-hs-link hover:underline"
              href="https://legal.hubspot.com/marketplace-tou"
              rel="noopener noreferrer"
              target="_blank"
            >
              HubSpot Marketplace Terms of Use
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Account access and authorization
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You authorize the App to access your HubSpot account through
              HubSpot OAuth using the scopes shown during installation.
            </li>
            <li>
              You are responsible for providing valid Mindbody credentials and
              keeping them accurate and up to date.
            </li>
            <li>
              You must have the rights and permissions needed to connect each
              account and to sync the data you choose to sync.
            </li>
            <li>
              You must not share dashboard access or attempt to access another
              customer&apos;s tenant data.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Acceptable use
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use the App in violation of applicable law or third-party terms</li>
            <li>
              Use the App for restricted industries or purposes prohibited by
              HubSpot&apos;s acceptable use policies
            </li>
            <li>
              Attempt to reverse engineer, disrupt, overload, or gain unauthorized
              access to the App or related systems
            </li>
            <li>
              Misrepresent your identity, submit false credentials, or use the
              App to process data you do not have permission to use
            </li>
            <li>
              Resell or sublicense the App except as expressly permitted in
              writing by us
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Your data</h2>
          <p>
            As between you and us, you retain ownership of your business data,
            including CRM and Mindbody records processed through the App. You
            grant us a limited license to access, process, store, and transmit
            that data solely to provide, secure, maintain, and improve the App
            as described in our Privacy Policy.
          </p>
          <p>
            You are responsible for the accuracy, quality, and legality of data
            you sync and for obtaining any consents required under applicable
            privacy laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Service availability and disclaimers
          </h2>
          <p>
            The App is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. We do not guarantee uninterrupted operation,
            error-free sync, real-time delivery, or that synced data will always
            match your source systems. Sync results depend on your configuration,
            third-party API behavior, network conditions, and data quality.
          </p>
          <p>
            To the fullest extent permitted by law, we disclaim all warranties,
            whether express, implied, or statutory, including implied warranties
            of merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Pricing</h2>
          <p>
            During the current release period, the App may be offered at no
            charge or on a free beta basis. We may introduce paid plans in the
            future with advance notice. If pricing changes, continued use after
            the effective date may require acceptance of new pricing terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Suspension and termination
          </h2>
          <p>
            You may stop using the App at any time by uninstalling it from your
            HubSpot account and removing Mindbody credentials in Settings.
          </p>
          <p>
            We may suspend or terminate access if you violate these Terms, if
            required by law, if a third-party integration becomes unavailable,
            or to protect the security or integrity of the service.
          </p>
          <p>
            Upon termination, we will stop processing new syncs. We may retain
            certain data for a reasonable period for security, backup, billing,
            and legal compliance, as described in our Privacy Policy. You may
            contact support to request deletion of tenant data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Limitation of liability
          </h2>
          <p>
            To the fullest extent permitted by law, we will not be liable for
            any indirect, incidental, special, consequential, or punitive
            damages, or for lost profits, revenue, data, or business
            opportunities, arising from or related to your use of the App.
          </p>
          <p>
            Our total liability for any claim arising out of or relating to the
            App or these Terms will not exceed the greater of (a) the amount you
            paid us for the App in the twelve months before the claim, or (b)
            one hundred U.S. dollars (USD $100).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Indemnity</h2>
          <p>
            You will defend, indemnify, and hold us harmless from claims, damages,
            losses, and expenses (including reasonable legal fees) arising from
            your use of the App, your data, your violation of these Terms, or
            your violation of applicable law or third-party rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Changes to these Terms
          </h2>
          <p>
            We may update these Terms from time to time. When we do, we will
            revise the &quot;Last updated&quot; date above. Material changes may
            also be communicated through the App, by email, or on our website.
            Continued use after changes become effective constitutes acceptance
            of the updated Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">General</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              These Terms, together with the Privacy Policy, are the entire
              agreement between you and us regarding the App.
            </li>
            <li>
              If any provision is found unenforceable, the remaining provisions
              will remain in effect.
            </li>
            <li>
              Our failure to enforce a provision is not a waiver of our right to
              do so later.
            </li>
            <li>
              These Terms are governed by the laws of the United States, without
              regard to conflict-of-law rules, except where mandatory local law
              applies.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about these Terms:{" "}
            {email ? (
              <a
                className="font-medium text-hs-link hover:underline"
                href={`mailto:${email}`}
              >
                {email}
              </a>
            ) : (
              <span className="font-medium text-slate-900">
                use the Support link in the site footer
              </span>
            )}
          </p>
        </section>

        <p className="border-t border-slate-200 pt-6 text-sm text-slate-500">
          These Terms are provided for marketplace and customer use. They are not
          legal advice. Have qualified counsel review them for your business and
          jurisdiction before submission.
        </p>

        <p className="text-sm">
          <Link href="/" className="text-hs-link hover:underline">
            ← Back to home
          </Link>
        </p>
      </article>
    </div>
  );
}
