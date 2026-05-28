import { resolveUrl } from './resolveUrl';

export function isMasterManifest(text: string): boolean {
  return /^#EXT-X-STREAM-INF/m.test(text);
}

function buildVariantEndpoint(absUris: string[], mode: string): string {
  const params = absUris.map((u) => `src=${encodeURIComponent(u)}`).join('&');
  return `variant.m3u8?${params}&mode=${mode}`;
}

export function rewriteMaster(text: string, srcUrls: string[], mode: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let prevWasStreamInf = false;

  for (const raw of lines) {
    const line = raw;
    if (line.startsWith('#EXT-X-ENDLIST')) continue;

    if (line.startsWith('#EXT-X-STREAM-INF') || line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
      out.push(line);
      prevWasStreamInf = line.startsWith('#EXT-X-STREAM-INF');

      if (line.startsWith('#EXT-X-I-FRAME-STREAM-INF')) {
        const last = out.pop()!;
        out.push(last.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${buildVariantEndpoint([resolveUrl(uri, srcUrls[0])], mode)}"`));
      }
      continue;
    }

    if (line.startsWith('#EXT-X-MEDIA')) {
      out.push(line.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${buildVariantEndpoint([resolveUrl(uri, srcUrls[0])], mode)}"`));
      continue;
    }

    if (prevWasStreamInf && line.trim() && !line.startsWith('#')) {
      const relUri = line.trim();
      const absUris = srcUrls.map((base) => resolveUrl(relUri, base));
      out.push(buildVariantEndpoint(absUris, mode));
      prevWasStreamInf = false;
      continue;
    }

    if (line.startsWith('#')) {
      prevWasStreamInf = false;
    }

    out.push(line);
  }

  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}
