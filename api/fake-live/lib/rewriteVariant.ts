import { resolveUrl, rewriteUriAttr } from './resolveUrl';

export type Mode = 'rolling' | 'event';

interface SegmentInfo {
  uri: string;
  durationSec: number;
  stickyMap?: string;
  stickyKey?: string;
  prefixLines: string[];
  sourceIndex: number;
}

interface ParsedVariant {
  headerLines: string[];
  segments: SegmentInfo[];
}

function tagName(line: string): string {
  const colon = line.indexOf(':');
  return colon === -1 ? line : line.slice(0, colon);
}

function parseVariant(text: string, srcUrl: string): ParsedVariant {
  const lines = text.split(/\r?\n/);
  const headerLines: string[] = [];
  const segments: SegmentInfo[] = [];

  let inSegments = false;
  let currentMap: string | undefined;
  let currentKey: string | undefined;
  let pendingPrefix: string[] = [];
  let currentDuration = 4;

  const HEADER_SKIP = new Set([
    '#EXT-X-ENDLIST',
    '#EXT-X-PLAYLIST-TYPE',
    '#EXT-X-MEDIA-SEQUENCE',
  ]);

  const PREFIX_TAGS = [
    '#EXT-X-BYTERANGE',
    '#EXT-X-DISCONTINUITY',
    '#EXT-X-BITRATE',
    '#EXT-X-CUE-OUT',
    '#EXT-X-CUE-IN',
    '#EXT-X-CUE',
    '#EXT-X-ASSET',
    '#EXT-X-SCTE35',
    '#EXT-X-DATERANGE',
  ];

  for (const raw of lines) {
    if (raw === '') continue;
    const line = raw;

    if (line.startsWith('#EXT-X-MAP')) {
      currentMap = rewriteUriAttr(line, srcUrl);
      continue;
    }
    if (line.startsWith('#EXT-X-KEY')) {
      currentKey = rewriteUriAttr(line, srcUrl);
      continue;
    }
    if (line.startsWith('#EXTINF:')) {
      const dur = parseFloat(line.slice('#EXTINF:'.length).split(',')[0]);
      if (!isNaN(dur)) currentDuration = dur;
      pendingPrefix.push(line);
      continue;
    }
    if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME')) {
      // dropped — we recompute
      continue;
    }
    if (line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE')) {
      if (!inSegments) headerLines.push(line);
      continue;
    }
    if (PREFIX_TAGS.some((t) => line.startsWith(t))) {
      pendingPrefix.push(line);
      continue;
    }

    if (line === '#EXTM3U') continue;

    if (line.startsWith('#')) {
      const tn = tagName(line);
      if (HEADER_SKIP.has(tn)) continue;
      if (inSegments) {
        pendingPrefix.push(line);
      } else {
        headerLines.push(line);
      }
      continue;
    }

    inSegments = true;
    const absUri = resolveUrl(line.trim(), srcUrl);
    segments.push({
      uri: absUri,
      durationSec: currentDuration,
      stickyMap: currentMap,
      stickyKey: currentKey,
      prefixLines: pendingPrefix,
      sourceIndex: segments.length,
    });
    pendingPrefix = [];
  }

  return { headerLines, segments };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 4;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

interface Emitted {
  segment: SegmentInfo;
  windowIndex: number;
}

function computeRolling(pool: SegmentInfo[], tick: number): { emitted: Emitted[]; mediaSequence: number } {
  const windowSize = Math.min(4, pool.length);
  const emitted: Emitted[] = [];
  for (let i = 0; i < windowSize; i++) {
    const poolIdx = ((tick + i) % pool.length + pool.length) % pool.length;
    emitted.push({ segment: pool[poolIdx], windowIndex: i });
  }
  return { emitted, mediaSequence: tick };
}

interface EventResult {
  emitted: Emitted[];
  mediaSequence: number;
  cycleStartTick: number;
}

function computeEvent(pool: SegmentInfo[], tick: number): EventResult {
  const cap = pool.length;
  const minCount = Math.min(3, cap);
  const cycleLen = Math.max(1, cap - minCount + 1);
  const positive = ((tick % cycleLen) + cycleLen) % cycleLen;
  const cycleNum = Math.floor(tick / cycleLen);
  const emittedCount = Math.min(cap, minCount + positive);
  const cycleStartTick = cycleNum * cycleLen;
  const emitted: Emitted[] = [];
  for (let i = 0; i < emittedCount; i++) {
    emitted.push({ segment: pool[i], windowIndex: i });
  }
  return { emitted, mediaSequence: cycleNum * cap + 1, cycleStartTick };
}

export function rewriteVariant(text: string, srcUrl: string, mode: Mode): string {
  const { headerLines, segments } = parseVariant(text, srcUrl);

  if (segments.length === 0) {
    throw new Error('Variant manifest has no segments');
  }

  const pool = segments;

  const segDur = Math.max(1, Math.round(median(pool.map((s) => s.durationSec)))) || 4;
  const tick = Math.floor(Date.now() / 1000 / segDur);

  const eventResult = mode === 'event' ? computeEvent(pool, tick) : null;
  const { emitted, mediaSequence } = eventResult ?? computeRolling(pool, tick);

  const out: string[] = ['#EXTM3U'];
  for (const h of headerLines) out.push(h);
  out.push(`#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`);
  if (mode === 'event') out.push('#EXT-X-PLAYLIST-TYPE:EVENT');

  const firstPdtEpoch = eventResult
    ? eventResult.cycleStartTick * segDur
    : Math.floor(Date.now() / 1000) - (emitted.length - 1) * segDur;
  out.push(`#EXT-X-PROGRAM-DATE-TIME:${new Date(firstPdtEpoch * 1000).toISOString()}`);

  let prevMap: string | undefined;
  let prevKey: string | undefined;
  let prevSourceIdx: number | undefined;

  for (const { segment } of emitted) {
    if (segment.stickyMap && segment.stickyMap !== prevMap) {
      out.push(segment.stickyMap);
      prevMap = segment.stickyMap;
    }
    if (segment.stickyKey && segment.stickyKey !== prevKey) {
      out.push(segment.stickyKey);
      prevKey = segment.stickyKey;
    }
    if (prevSourceIdx != null && segment.sourceIndex !== prevSourceIdx + 1) {
      if (!segment.prefixLines.some((l) => l.startsWith('#EXT-X-DISCONTINUITY') && !l.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE'))) {
        out.push('#EXT-X-DISCONTINUITY');
      }
    }
    for (const p of segment.prefixLines) out.push(p);
    out.push(segment.uri);
    prevSourceIdx = segment.sourceIndex;
  }

  return out.join('\n') + '\n';
}
