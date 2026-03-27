import type { TrackRecordingState, RecordingSession } from './types';

/**
 * Generate a VOD media playlist M3U8 from recorded segments.
 */
export function rewriteMediaPlaylist(trackState: TrackRecordingState): string {
  const lines: string[] = ['#EXTM3U'];

  if (trackState.version != null) {
    lines.push(`#EXT-X-VERSION:${trackState.version}`);
  }

  if (trackState.targetDuration != null) {
    lines.push(`#EXT-X-TARGETDURATION:${trackState.targetDuration}`);
  }

  lines.push('#EXT-X-MEDIA-SEQUENCE:0');
  lines.push('#EXT-X-PLAYLIST-TYPE:VOD');

  let lastMapUri: string | undefined;
  let lastKeyUri: string | undefined;

  for (const seg of trackState.segments) {
    // Init segment (EXT-X-MAP) — emit when it changes
    const mapRes = findInitForSegment(trackState);
    if (mapRes && mapRes.uri !== lastMapUri) {
      lines.push(`#EXT-X-MAP:URI="${mapRes.localFilename}"`);
      lastMapUri = mapRes.uri;
    }

    // Encryption key — emit when it changes
    const keyRes = findKeyForSegment(trackState);
    if (keyRes && keyRes.uri !== lastKeyUri) {
      lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="${keyRes.localFilename}"`);
      lastKeyUri = keyRes.uri;
    }

    if (seg.discontinuity) {
      lines.push('#EXT-X-DISCONTINUITY');
    }

    if (seg.dateTimeString) {
      lines.push(`#EXT-X-PROGRAM-DATE-TIME:${seg.dateTimeString}`);
    }

    if (seg.cueOut) {
      lines.push(`#EXT-X-CUE-OUT:${seg.cueOut}`);
    }
    if (seg.cueOutCont) {
      lines.push(`#EXT-X-CUE-OUT-CONT:${seg.cueOutCont}`);
    }
    if (seg.cueIn != null) {
      lines.push('#EXT-X-CUE-IN');
    }

    lines.push(`#EXTINF:${seg.duration.toFixed(6)},`);
    lines.push(seg.localFilename);
  }

  lines.push('#EXT-X-ENDLIST');
  lines.push('');

  return lines.join('\n');
}

/**
 * Rewrite the master playlist to reference local folder paths.
 * Parses the original master text line-by-line and substitutes URIs.
 */
export function rewriteMasterPlaylist(session: RecordingSession): string {
  const tracksByOriginalUrl = new Map<string, TrackRecordingState>();
  for (const [, ts] of session.tracks) {
    tracksByOriginalUrl.set(ts.track.playlistUrl, ts);
  }

  const lines = session.masterManifestText.split('\n');
  const result: string[] = [];
  let skipNextUri = false;
  let pendingTrack: TrackRecordingState | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // EXT-X-STREAM-INF: the next non-comment line is the variant URI
    if (trimmed.startsWith('#EXT-X-STREAM-INF:')) {
      // Find the variant URI on the next line
      const nextLine = findNextNonEmpty(lines, i + 1);
      if (nextLine != null) {
        const resolved = resolveAgainstMaster(session.masterUrl, nextLine.trim());
        const ts = tracksByOriginalUrl.get(resolved);
        if (ts && ts.segments.length > 0) {
          result.push(line);
          pendingTrack = ts;
          skipNextUri = true;
          continue;
        }
      }
      // Track has no recorded segments — skip this variant entirely
      skipNextUri = true;
      pendingTrack = undefined;
      continue;
    }

    // EXT-X-MEDIA with URI attribute
    if (trimmed.startsWith('#EXT-X-MEDIA:') && trimmed.includes('URI=')) {
      const rewritten = rewriteMediaTag(trimmed, tracksByOriginalUrl, session.masterUrl);
      if (rewritten) {
        result.push(rewritten);
      }
      continue;
    }

    // URI line following EXT-X-STREAM-INF
    if (skipNextUri && !trimmed.startsWith('#') && trimmed.length > 0) {
      skipNextUri = false;
      if (pendingTrack) {
        result.push(`${pendingTrack.track.folderPath}/playlist.m3u8`);
        pendingTrack = undefined;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

function findNextNonEmpty(lines: string[], startIdx: number): string | undefined {
  for (let i = startIdx; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.length > 0 && !t.startsWith('#')) return t;
  }
  return undefined;
}

function resolveAgainstMaster(masterUrl: string, relativeUri: string): string {
  try {
    return new URL(relativeUri, masterUrl).href;
  } catch {
    return relativeUri;
  }
}

function rewriteMediaTag(
  line: string,
  tracksByUrl: Map<string, TrackRecordingState>,
  masterUrl: string,
): string | null {
  const uriMatch = line.match(/URI="([^"]+)"/);
  if (!uriMatch) return line;

  const originalUri = uriMatch[1];
  const resolved = resolveAgainstMaster(masterUrl, originalUri);
  const ts = tracksByUrl.get(resolved);

  if (!ts || ts.segments.length === 0) return null;

  return line.replace(
    `URI="${originalUri}"`,
    `URI="${ts.track.folderPath}/playlist.m3u8"`,
  );
}

function findInitForSegment(
  trackState: TrackRecordingState,
): { uri: string; localFilename: string } | undefined {
  const first = trackState.initSegments.values().next();
  if (!first.done) return { uri: first.value.uri, localFilename: first.value.localFilename };
  return undefined;
}

function findKeyForSegment(
  trackState: TrackRecordingState,
): { uri: string; localFilename: string } | undefined {
  const first = trackState.keys.values().next();
  if (!first.done) return { uri: first.value.uri, localFilename: first.value.localFilename };
  return undefined;
}
