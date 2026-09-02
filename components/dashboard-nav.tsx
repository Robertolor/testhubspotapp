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
    <nav className="flex gap-1 border-b border-slate-200 pb-4">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            isActive(link.href)
              ? "bg-teal-50 text-teal-800"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
