export function getSupportEmail(): string | undefined {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return email || undefined;
}
