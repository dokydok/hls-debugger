declare module 'm3u8-parser' {
  export class Parser {
    push(chunk: string): void;
    end(): void;
    manifest: {
      allowCache?: boolean;
      playlists: Array<{
        uri: string;
        attributes: Record<string, any>;
        timeline: number;
      }>;
      mediaGroups: {
        AUDIO: Record<string, Record<string, any>>;
        VIDEO: Record<string, Record<string, any>>;
        SUBTITLES: Record<string, Record<string, any>>;
        'CLOSED-CAPTIONS': Record<string, Record<string, any>>;
      };
      segments: Array<{
        uri: string;
        duration: number;
        title?: string;
        timeline: number;
        discontinuity?: boolean;
        programDateTime?: number;
        dateTimeString?: string;
        dateTimeObject?: Date;
        key?: { method: string; uri?: string; iv?: any };
        map?: {
          uri: string;
          byterange?: { length: number; offset: number };
          key?: any;
        };
        byterange?: { length: number; offset: number };
        cueOut?: string;
        cueOutCont?: string;
        cueIn?: string;
        parts?: Array<{
          uri: string;
          duration: number;
          independent?: boolean;
          gap?: boolean;
          byterange?: { length: number; offset: number };
        }>;
        preloadHints?: Array<{
          type: string;
          uri: string;
          byterange?: { length: number; offset: number };
        }>;
        custom?: Record<string, any>;
        [key: string]: any;
      }>;
      targetDuration?: number;
      endList?: boolean;
      playlistType?: string;
      version?: number;
      totalDuration?: number;
      discontinuityStarts?: number[];
      discontinuitySequence?: number;
      mediaSequence?: number;
      independentSegments?: boolean;
      iFramesOnly?: boolean;
      dateTimeString?: string;
      dateTimeObject?: Date;
      start?: { timeOffset: number; precise?: boolean };
      dateRanges?: Array<{
        id: string;
        class?: string;
        startDate?: Date;
        endDate?: Date;
        duration?: number;
        plannedDuration?: number;
        scte35Cmd?: string;
        scte35Out?: string;
        scte35In?: string;
        endOnNext?: boolean;
        [key: string]: any;
      }>;
      iFramePlaylists?: Array<{
        uri: string;
        attributes: Record<string, any>;
        timeline: number;
      }>;
      serverControl?: {
        canBlockReload?: boolean;
        canSkipDateranges?: boolean;
        canSkipUntil?: number;
        holdBack?: number;
        partHoldBack?: number;
      };
      partInf?: { partTarget?: number; [key: string]: any };
      partTargetDuration?: number;
      renditionReports?: Array<{
        uri: string;
        lastMsn?: number;
        lastPart?: number;
        [key: string]: any;
      }>;
      skip?: {
        skippedSegments?: number;
        recentlyRemovedDateranges?: string[];
      };
      contentProtection?: Record<string, any>;
      contentSteering?: { serverUri?: string; pathwayId?: string };
      definitions?: Record<string, string>;
      custom?: Record<string, any>;
      [key: string]: any;
    };
  }
}
