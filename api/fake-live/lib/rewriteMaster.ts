import { resolveUrl } from './resolveUrl';

export function isMasterManifest(text: string): boolean {
  return /^#EXT-X-STREAM-INF/m.test(text);
}

function buildVariantEndpoint(absUri: string, mode: string): string {
  return `variant.m3u8?src=${encodeURIComponent(absUri)}&mode=${mode}`;
}

export function rewriteMaster(text: string, srcUrl: string, mode: string): string {
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
        out.push(last.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${buildVariantEndpoint(resolveUrl(uri, srcUrl), mode)}"`));
      }
      continue;
    }

    if (line.startsWith('#EXT-X-MEDIA')) {
      out.push(line.replace(/URI="([^"]+)"/, (_m, uri) => `URI="${buildVariantEndpoint(resolveUrl(uri, srcUrl), mode)}"`));
      continue;
    }

    if (prevWasStreamInf && line.trim() && !line.startsWith('#')) {
      const abs = resolveUrl(line.trim(), srcUrl);
      out.push(buildVariantEndpoint(abs, mode));
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
