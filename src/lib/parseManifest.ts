import { Parser } from 'm3u8-parser';
import type {
  ParsedManifest, Variant, MediaTrackGroup, MediaTrack,
  SegmentInfo, SegmentAnalysis, LiveStreamInfo,
  EncryptionInfo, DateRangeInfo, LowLatencyInfo,
  IFramePlaylistInfo, StartInfo,
} from './types';
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
    hdcpLevel: p.attributes?.['HDCP-LEVEL'],
    programId: p.attributes?.['PROGRAM-ID'],
    name: p.attributes?.NAME,
  }));

  const audioGroups = extractMediaGroups(m.mediaGroups?.AUDIO, 'AUDIO', manifestUrl);
  const videoGroups = extractMediaGroups(m.mediaGroups?.VIDEO, 'VIDEO', manifestUrl);
  const subtitleGroups = extractMediaGroups(m.mediaGroups?.SUBTITLES, 'SUBTITLES', manifestUrl);
  const closedCaptionGroups = extractMediaGroups(
    m.mediaGroups?.['CLOSED-CAPTIONS'], 'CLOSED-CAPTIONS', manifestUrl,
  );

  const rawSegments = m.segments || [];
  const segments: SegmentInfo[] = rawSegments.map((seg, i) => ({
    index: i,
    uri: resolveUrl(manifestUrl, seg.uri),
    duration: seg.duration,
    title: seg.title || undefined,
    timeline: seg.timeline,
    discontinuity: !!seg.discontinuity,
    programDateTime: seg.programDateTime,
    dateTimeString: seg.dateTimeString || undefined,
    byterange: seg.byterange || undefined,
    key: seg.key && seg.key.method !== 'NONE' ? {
      method: seg.key.method,
      uri: seg.key.uri,
      iv: formatIV(seg.key.iv),
    } : undefined,
    map: seg.map ? {
      uri: resolveUrl(manifestUrl, seg.map.uri),
      byterange: seg.map.byterange,
    } : undefined,
    cueOut: seg.cueOut || undefined,
    cueOutCont: seg.cueOutCont || undefined,
    cueIn: seg.cueIn || undefined,
    partsCount: seg.parts?.length,
  }));

  const segmentAnalysis = computeSegmentAnalysis(segments, m.targetDuration);
  const liveStream = detectLiveStream(isMaster, segments, m, segmentAnalysis);
  const encryption = buildEncryptionInfo(segments, m.contentProtection);
  const lowLatency = buildLowLatencyInfo(rawSegments, m, manifestUrl);

  const dateRanges: DateRangeInfo[] = (m.dateRanges || []).map((dr: any) => {
    const clientAttributes: Record<string, unknown> = {};
    for (const key of Object.keys(dr)) {
      if (/^x[A-Z]/.test(key)) clientAttributes[key] = dr[key];
    }
    return {
      id: dr.id,
      class: dr.class,
      startDate: dr.startDate instanceof Date ? dr.startDate.toISOString() : dr.startDate,
      endDate: dr.endDate instanceof Date ? dr.endDate.toISOString() : dr.endDate,
      duration: dr.duration,
      plannedDuration: dr.plannedDuration,
      scte35Cmd: dr.scte35Cmd,
      scte35Out: dr.scte35Out,
      scte35In: dr.scte35In,
      endOnNext: dr.endOnNext,
      clientAttributes,
    };
  });

  const iFramePlaylists: IFramePlaylistInfo[] = (m.iFramePlaylists || []).map((p: any) => ({
    uri: resolveUrl(manifestUrl, p.uri),
    bandwidth: p.attributes?.BANDWIDTH ?? 0,
    resolution: p.attributes?.RESOLUTION,
    codecs: p.attributes?.CODECS,
    videoRange: p.attributes?.['VIDEO-RANGE'],
  }));

  const start: StartInfo | undefined = m.start
    ? { timeOffset: m.start.timeOffset, precise: m.start.precise }
    : undefined;

  return {
    isMaster,
    raw: text,
    url: manifestUrl,
    variants,
    audioGroups,
    videoGroups,
    subtitleGroups,
    closedCaptionGroups,
    iFramePlaylists,
    segments,
    segmentAnalysis,
    liveStream,
    version: m.version,
    targetDuration: m.targetDuration,
    playlistType: m.playlistType,
    endList: m.endList,
    mediaSequence: m.mediaSequence,
    discontinuitySequence: m.discontinuitySequence,
    discontinuityCount: m.discontinuityStarts?.length,
    independentSegments: m.independentSegments || undefined,
    start,
    dateRanges,
    encryption,
    lowLatency,
    issues: [],
  };
}

function computeSegmentAnalysis(
  segments: SegmentInfo[],
  targetDuration?: number,
): SegmentAnalysis | undefined {
  if (segments.length === 0) return undefined;

  const durations = segments.map(s => s.duration);
  const totalDuration = durations.reduce((a, b) => a + b, 0);
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const avgDuration = totalDuration / durations.length;

  const td = targetDuration ?? Infinity;
  const segmentsExceedingTarget = segments
    .filter(s => s.duration > td)
    .map(s => s.index);

  const variance = durations.reduce((sum, d) => sum + (d - avgDuration) ** 2, 0) / durations.length;

  const pdtSegments = segments.filter(s => s.dateTimeString);
  let pdtRange: { first: string; last: string } | undefined;
  if (pdtSegments.length > 0) {
    pdtRange = {
      first: pdtSegments[0].dateTimeString!,
      last: pdtSegments[pdtSegments.length - 1].dateTimeString!,
    };
  }

  return {
    minDuration,
    maxDuration,
    avgDuration,
    totalDuration,
    targetDurationCompliant: segmentsExceedingTarget.length === 0,
    segmentsExceedingTarget,
    byteRangeSegmentCount: segments.filter(s => s.byterange).length,
    hasInitSegment: segments.some(s => s.map),
    initSegmentUri: segments.find(s => s.map)?.map?.uri,
    timelineCount: new Set(segments.map(s => s.timeline)).size,
    cueOutCount: segments.filter(s => s.cueOut).length,
    cueInCount: segments.filter(s => s.cueIn).length,
    pdtRange,
    durationStdDev: Math.sqrt(variance),
  };
}

function detectLiveStream(
  isMaster: boolean,
  segments: SegmentInfo[],
  m: any,
  analysis?: SegmentAnalysis,
): LiveStreamInfo | undefined {
  if (isMaster || segments.length === 0) return undefined;

  const isLive = !m.endList && m.playlistType !== 'VOD';
  if (!isLive) return undefined;

  const windowDuration = analysis?.totalDuration ?? 0;
  const isEvent = m.playlistType === 'EVENT';
  const isDVR = isEvent || (windowDuration > 5 * (m.targetDuration ?? 6));

  let estimatedLiveEdge: string | undefined;
  const lastPdt = [...segments].reverse().find(s => s.programDateTime != null);
  if (lastPdt?.programDateTime) {
    const edgeMs = lastPdt.programDateTime + lastPdt.duration * 1000;
    estimatedLiveEdge = new Date(edgeMs).toISOString();
  }

  return {
    isLive: true,
    isDVR,
    isEvent,
    windowDuration,
    windowSegmentCount: segments.length,
    mediaSequence: m.mediaSequence ?? 0,
    estimatedLiveEdge,
    suggestedPollInterval: m.partInf?.partTarget ?? m.targetDuration,
  };
}

function buildEncryptionInfo(
  segments: SegmentInfo[],
  contentProtection?: Record<string, any>,
): EncryptionInfo {
  const keySet = new Map<string, { method: string; uri?: string }>();
  for (const seg of segments) {
    if (seg.key) {
      const id = `${seg.key.method}|${seg.key.uri || ''}`;
      if (!keySet.has(id)) keySet.set(id, { method: seg.key.method, uri: seg.key.uri });
    }
  }
  const keys = [...keySet.values()];
  return {
    isEncrypted: keys.length > 0,
    method: keys[0]?.method,
    keyUri: keys[0]?.uri,
    keyRotationCount: keys.length,
    uniqueKeys: keys,
    contentProtection: contentProtection || undefined,
  };
}

function buildLowLatencyInfo(rawSegments: any[], m: any, baseUrl: string): LowLatencyInfo {
  let totalParts = 0;
  const preloadHints: Array<{ type: string; uri: string }> = [];
  for (const seg of rawSegments) {
    if (seg.parts) totalParts += seg.parts.length;
    if (seg.preloadHints) {
      for (const h of seg.preloadHints) {
        preloadHints.push({ type: h.type, uri: h.uri ? resolveUrl(baseUrl, h.uri) : '' });
      }
    }
  }

  return {
    hasLowLatency: !!(m.serverControl || m.partInf || totalParts > 0),
    partTargetDuration: m.partInf?.partTarget,
    totalPartsCount: totalParts,
    serverControl: m.serverControl ? { ...m.serverControl } : undefined,
    preloadHints,
    renditionReports: (m.renditionReports || []).map((r: any) => ({
      uri: r.uri,
      lastMsn: r.lastMsn,
      lastPart: r.lastPart,
    })),
    skip: m.skip ? {
      skippedSegments: m.skip.skippedSegments,
      recentlyRemovedDateranges: m.skip.recentlyRemovedDateranges,
    } : undefined,
  };
}

function formatIV(iv: any): string | undefined {
  if (!iv) return undefined;
  if (typeof iv === 'string') return iv;
  if (iv instanceof Uint32Array || Array.isArray(iv)) {
    return '0x' + Array.from(iv).map((n: number) => n.toString(16).padStart(8, '0')).join('');
  }
  return String(iv);
}

function extractMediaGroups(
  groups: Record<string, Record<string, any>> | undefined,
  type: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS',
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
