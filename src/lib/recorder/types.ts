export type RecordingState = 'idle' | 'recording' | 'stopping' | 'processing';

export interface RecordingTrack {
  id: string;
  type: 'video' | 'audio' | 'subtitle';
  label: string;
  playlistUrl: string;
  folderPath: string;
}

export interface RecordedSegment {
  uri: string;
  localFilename: string;
  data: ArrayBuffer;
  duration: number;
  mediaSequence: number;
  discontinuity: boolean;
  programDateTime?: number;
  dateTimeString?: string;
  timeline: number;
  cueOut?: string;
  cueOutCont?: string;
  cueIn?: string;
}

export interface RecordedResource {
  uri: string;
  localFilename: string;
  data: ArrayBuffer;
}

export interface TrackRecordingState {
  track: RecordingTrack;
  segments: RecordedSegment[];
  seenSegmentUris: Set<string>;
  initSegments: Map<string, RecordedResource>;
  keys: Map<string, RecordedResource>;
  targetDuration?: number;
  version?: number;
  firstMediaSequence?: number;
  error?: string;
}

export interface RecordingSession {
  state: RecordingState;
  startedAt: number;
  tracks: Map<string, TrackRecordingState>;
  masterManifestText: string;
  masterUrl: string;
  totalBytes: number;
  segmentCount: number;
  errors: string[];
}

export interface RecordingStats {
  state: RecordingState;
  elapsed: number;
  segmentCount: number;
  totalBytes: number;
  trackCount: number;
  errors: string[];
}
