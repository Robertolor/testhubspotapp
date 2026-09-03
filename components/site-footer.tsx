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
    <footer className="mt-auto border-t border-brand-border bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 text-sm text-brand-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="font-medium text-brand-ink">Mindbody Sync</p>

        <nav
          aria-label="Legal and help"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-brand-link hover:underline"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={`mailto:${supportEmail}`}
            className="text-brand-link hover:underline"
          >
            Support
          </a>
        </nav>

        <a
          href={`mailto:${supportEmail}`}
          className="text-brand-muted hover:text-brand-ink hover:underline sm:text-right"
        >
          {supportEmail}
        </a>
      </div>
    </footer>
  );
}
