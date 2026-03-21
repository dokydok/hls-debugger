import { Parser } from 'm3u8-parser';
import type { ParsedManifest, Variant, MediaTrackGroup, MediaTrack } from './types';
import { resolveUrl } from './resolveUrl';

export function parseManifest(text: string, manifestUrl: string): ParsedManifest {
  const parser = new Parser();
  parser.push(text);
  parser.end();
  const m = parser.manifest;

  const isMaster = Array.isArray(m.playlists) && m.playlists.length > 0;

  const variants: Variant[] = (m.playlists || []).map((p) => ({
    uri: resolveUrl(manifestUrl, p.uri),
    bandwidth: p.attributes?.BANDWIDTH ?? 0,
    averageBandwidth: p.attributes?.['AVERAGE-BANDWIDTH'],
    resolution: p.attributes?.RESOLUTION,
    codecs: p.attributes?.CODECS,
    frameRate: p.attributes?.['FRAME-RATE'],
    audioGroup: p.attributes?.AUDIO,
    subtitleGroup: p.attributes?.SUBTITLES,
    closedCaptions: p.attributes?.['CLOSED-CAPTIONS'],
    videoRange: p.attributes?.['VIDEO-RANGE'],
  }));

  const audioGroups = extractMediaGroups(m.mediaGroups?.AUDIO, 'AUDIO', manifestUrl);
  const subtitleGroups = extractMediaGroups(m.mediaGroups?.SUBTITLES, 'SUBTITLES', manifestUrl);
  const closedCaptionGroups = extractMediaGroups(
    m.mediaGroups?.['CLOSED-CAPTIONS'],
    'CLOSED-CAPTIONS',
    manifestUrl,
  );

  let isEncrypted = false;
  let encryptionMethod: string | undefined;
  for (const seg of m.segments || []) {
    if (seg.key && seg.key.method && seg.key.method !== 'NONE') {
      isEncrypted = true;
      encryptionMethod = seg.key.method;
      break;
    }
  }

  return {
    isMaster,
    raw: text,
    url: manifestUrl,
    variants,
    audioGroups,
    subtitleGroups,
    closedCaptionGroups,
    version: m.version,
    targetDuration: m.targetDuration,
    playlistType: m.playlistType,
    endList: m.endList,
    totalDuration: m.totalDuration,
    segmentCount: m.segments?.length,
    isEncrypted,
    encryptionMethod,
    discontinuityCount: m.discontinuityStarts?.length,
    mediaSequence: m.mediaSequence,
  };
}

function extractMediaGroups(
  groups: Record<string, Record<string, any>> | undefined,
  type: 'AUDIO' | 'SUBTITLES' | 'CLOSED-CAPTIONS',
  baseUrl: string,
): MediaTrackGroup[] {
  if (!groups) return [];
  return Object.entries(groups).map(([groupId, tracks]) => ({
    groupId,
    type,
    tracks: Object.entries(tracks).map(
      ([name, attrs]): MediaTrack => ({
        name,
        groupId,
        type,
        language: attrs.language,
        uri: attrs.uri ? resolveUrl(baseUrl, attrs.uri) : undefined,
        isDefault: attrs.default,
        autoselect: attrs.autoselect,
        instreamId: attrs.instreamId,
        forced: attrs.forced,
        characteristics: attrs.characteristics,
      }),
    ),
  }));
}
