import type { IncomingMessage, ServerResponse } from 'http';
import { isMasterManifest, rewriteMaster } from './lib/rewriteMaster';
import { rewriteVariant, type Mode } from './lib/rewriteVariant';

interface VercelReq extends IncomingMessage {
  query: Record<string, string | string[] | undefined>;
}

function qs(req: VercelReq, key: string): string | undefined {
  const v = req.query[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

function jsonError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({ error: message }));
}

function lastSegment(pathname: string): string {
  const idx = pathname.lastIndexOf('/');
  return idx === -1 ? pathname : pathname.slice(idx + 1);
}

function parseMode(raw: string | undefined): Mode {
  return raw === 'event' ? 'event' : 'rolling';
}

async function checkCors(src: string, browserOrigin: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const r = await fetch(src, { method: 'HEAD', headers: { Origin: browserOrigin } });
    const acao = r.headers.get('access-control-allow-origin');
    if (!acao) {
      return { ok: false, reason: `Source manifest at ${src} returned no Access-Control-Allow-Origin header for Origin "${browserOrigin}". hls.js can't load it from a non-CORS origin.` };
    }
    if (acao !== '*' && acao !== browserOrigin) {
      return { ok: false, reason: `Source ACAO is "${acao}" but browser Origin is "${browserOrigin}".` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Failed to probe source ${src}: ${(e as Error).message}` };
  }
}

export default async function handler(req: VercelReq, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const url = new URL(req.url ?? '/', 'http://localhost');
  const filename = lastSegment(url.pathname);

  const src = qs(req, 'src');
  if (!src) {
    jsonError(res, 400, 'Missing required query param: src (upstream manifest URL)');
    return;
  }

  const mode = parseMode(qs(req, 'mode'));
  const browserOrigin =
    (req.headers.origin as string | undefined) ??
    (req.headers.referer ? new URL(req.headers.referer as string).origin : 'http://localhost:5173');

  if (qs(req, 'skipCorsCheck') !== '1') {
    const corsCheck = await checkCors(src, browserOrigin);
    if (!corsCheck.ok) {
      jsonError(res, 400, corsCheck.reason ?? 'CORS check failed');
      return;
    }
  }

  let upstreamText: string;
  try {
    const r = await fetch(src, { headers: { Origin: browserOrigin } });
    if (!r.ok) {
      jsonError(res, 502, `Failed to fetch upstream ${src}: HTTP ${r.status}`);
      return;
    }
    upstreamText = await r.text();
  } catch (e) {
    jsonError(res, 502, `Failed to fetch upstream ${src}: ${(e as Error).message}`);
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

  try {
    if (filename === 'master.m3u8' || filename === '' || filename === 'index.m3u8') {
      if (isMasterManifest(upstreamText)) {
        res.end(rewriteMaster(upstreamText, src, mode));
      } else {
        res.end(rewriteVariant(upstreamText, src, mode));
      }
      return;
    }

    if (filename === 'variant.m3u8') {
      res.end(rewriteVariant(upstreamText, src, mode));
      return;
    }

    jsonError(res, 404, `Unknown manifest path: ${filename}`);
  } catch (e) {
    jsonError(res, 500, `Manifest rewrite failed: ${(e as Error).message}`);
  }
}
