export function safeInternalPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const base = new URL("https://internal.invalid");
    const resolved = new URL(value, base);
    if (resolved.origin !== base.origin) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
