import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  // Preview deployments: OAuth callback and cookies must stay on this host.
  if (process.env.VERCEL_ENV === "preview") {
    const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (host) return `https://${host}`;
  }

  if (process.env.VERCEL_ENV === "production") {
    if (explicit) return explicit;
    const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (prodHost) return `https://${prodHost}`;
  }

  if (explicit) return explicit;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
