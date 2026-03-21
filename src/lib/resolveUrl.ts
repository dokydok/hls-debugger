export function resolveUrl(base: string, relative: string): string {
  if (!relative) return base;
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}
