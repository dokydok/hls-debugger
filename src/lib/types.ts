export interface ParsedManifest {
  isMaster: boolean;
  raw: string;
  url: string;

  variants: Variant[];
  audioGroups: MediaTrackGroup[];
  videoGroups: MediaTrackGroup[];
  subtitleGroups: MediaTrackGroup[];
  closedCaptionGroups: MediaTrackGroup[];
  iFramePlaylists: IFramePlaylistInfo[];

  segments: SegmentInfo[];
  segmentAnalysis?: SegmentAnalysis;
  liveStream?: LiveStreamInfo;

  version?: number;
  targetDuration?: number;
  playlistType?: string;
  endList?: boolean;
  mediaSequence?: number;
  discontinuitySequence?: number;
  discontinuityCount?: number;
  independentSegments?: boolean;
  start?: StartInfo;
  dateRanges: DateRangeInfo[];
  encryption: EncryptionInfo;
  lowLatency: LowLatencyInfo;

  issues: ManifestIssue[];
}

export interface Variant {
  uri: string;
  bandwidth: number;
  averageBandwidth?: number;
  resolution?: { width: number; height: number };
  codecs?: string;
  frameRate?: number;
  audioGroup?: string;
  subtitleGroup?: string;
  closedCaptions?: string;
  videoRange?: string;
  hdcpLevel?: string;
  programId?: number;
  name?: string;
}

export interface MediaTrack {
  name: string;
  groupId: string;
  type: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  language?: string;
  uri?: string;
  isDefault?: boolean;
  autoselect?: boolean;
  instreamId?: string;
  forced?: boolean;
  characteristics?: string;
}

export interface MediaTrackGroup {
  groupId: string;
  type: 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  tracks: MediaTrack[];
}

export interface RuntimeTrack {
  id: number;
  name: string;
  language?: string;
}

export interface SegmentInfo {
  index: number;
  uri: string;
  duration: number;
  title?: string;
  timeline: number;
  discontinuity: boolean;
  programDateTime?: number;
  dateTimeString?: string;
  byterange?: { length: number; offset: number };
  key?: { method: string; uri?: string; iv?: string };
  map?: { uri: string; byterange?: { length: number; offset: number } };
  cueOut?: string;
  cueOutCont?: string;
  cueIn?: string;
  partsCount?: number;
}

export interface SegmentAnalysis {
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  totalDuration: number;
  targetDurationCompliant: boolean;
  segmentsExceedingTarget: number[];
  byteRangeSegmentCount: number;
  hasInitSegment: boolean;
  initSegmentUri?: string;
  timelineCount: number;
  cueOutCount: number;
  cueInCount: number;
  pdtRange?: { first: string; last: string };
  durationStdDev: number;
}

export interface LiveStreamInfo {
  isLive: boolean;
  isDVR: boolean;
  isEvent: boolean;
  windowDuration: number;
  windowSegmentCount: number;
  mediaSequence: number;
  estimatedLiveEdge?: string;
  suggestedPollInterval?: number;
}

export interface EncryptionInfo {
  isEncrypted: boolean;
  method?: string;
  keyUri?: string;
  keyRotationCount: number;
  uniqueKeys: Array<{ method: string; uri?: string }>;
  contentProtection?: Record<string, any>;
}

export interface DateRangeInfo {
  id: string;
  class?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  plannedDuration?: number;
  scte35Cmd?: string;
  scte35Out?: string;
  scte35In?: string;
  endOnNext?: boolean;
  clientAttributes: Record<string, unknown>;
}

export interface LowLatencyInfo {
  hasLowLatency: boolean;
  partTargetDuration?: number;
  totalPartsCount: number;
  serverControl?: {
    canBlockReload?: boolean;
    canSkipDateranges?: boolean;
    canSkipUntil?: number;
    holdBack?: number;
    partHoldBack?: number;
  };
  preloadHints: Array<{ type: string; uri: string }>;
  renditionReports: Array<{ uri: string; lastMsn?: number; lastPart?: number }>;
  skip?: {
    skippedSegments?: number;
    recentlyRemovedDateranges?: string[];
  };
}

export interface IFramePlaylistInfo {
  uri: string;
  bandwidth: number;
  resolution?: { width: number; height: number };
  codecs?: string;
  videoRange?: string;
}

export interface StartInfo {
  timeOffset: number;
  precise?: boolean;
}

export interface ManifestIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  details?: string;
}
