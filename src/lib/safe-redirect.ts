/**
 * Returns a same-origin relative path, or null if the value is unsafe
 * (open redirect / protocol-relative / absolute URL).
 */
export function safeInternalPath(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return null;
  }
  if (trimmed.includes("://")) {
    return null;
  }
  if (trimmed.includes("\\")) {
    return null;
  }

  return trimmed;
}
