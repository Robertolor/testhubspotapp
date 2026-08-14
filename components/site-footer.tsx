import Link from "next/link";
import { getSupportEmail } from "@/lib/support";

const footerLinks = [
  { href: "/setup-guide", label: "Setup guide" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export function SiteFooter() {
  const supportEmail = getSupportEmail();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-slate-700">Mindbody ↔ HubSpot Sync</p>

        <nav
          aria-label="Legal and help"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-teal-700 hover:underline"
            >
              {link.label}
            </Link>
          ))}
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="text-teal-700 hover:underline"
            >
              Support
            </a>
          ) : null}
        </nav>

        {supportEmail ? (
          <a
            href={`mailto:${supportEmail}`}
            className="text-slate-600 hover:text-teal-700 hover:underline sm:text-right"
          >
            {supportEmail}
          </a>
        ) : (
          <p className="text-xs text-slate-400 sm:text-right">
            Support email configured at deploy
          </p>
        )}
      </div>
    </footer>
  );
}
