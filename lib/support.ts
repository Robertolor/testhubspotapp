export const SUPPORT_EMAIL = "integrations@methoddata.com";

export function getSupportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || SUPPORT_EMAIL;
}
