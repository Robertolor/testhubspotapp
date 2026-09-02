"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/setup", label: "Setup" },
  { href: "/settings", label: "Settings" },
  { href: "/settings/mappings", label: "Mappings" },
  { href: "/reports", label: "Reports" },
  { href: "/billing", label: "Billing" },
];

export function DashboardNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/settings") {
      return pathname === "/settings";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex w-full flex-wrap gap-1 border-b border-hs-border">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
            isActive(link.href)
              ? "border-hs-orange font-semibold text-hs-navy"
              : "border-transparent font-medium text-hs-muted hover:text-hs-navy"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
