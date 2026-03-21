export interface ParsedManifest {
  isMaster: boolean;
  raw: string;
  url: string;
  variants: Variant[];
  audioGroups: MediaTrackGroup[];
  subtitleGroups: MediaTrackGroup[];
  closedCaptionGroups: MediaTrackGroup[];
  version?: number;
  targetDuration?: number;
  playlistType?: string;
  endList?: boolean;
  totalDuration?: number;
  segmentCount?: number;
  isEncrypted?: boolean;
  encryptionMethod?: string;
  discontinuityCount?: number;
  mediaSequence?: number;
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
}

export interface MediaTrack {
  name: string;
  groupId: string;
  type: 'AUDIO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
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
  type: 'AUDIO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';
  tracks: MediaTrack[];
}

export interface RuntimeTrack {
  id: number;
  name: string;
  language?: string;
}
