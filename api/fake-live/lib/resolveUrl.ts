export function resolveUrl(uri: string, base: string): string {
  return new URL(uri, base).toString();
}

export function rewriteUriAttr(line: string, base: string): string {
  return line.replace(/URI="([^"]+)"/g, (_m, uri) => `URI="${resolveUrl(uri, base)}"`);
}
