declare module 'm3u8-parser' {
  export class Parser {
    push(chunk: string): void;
    end(): void;
    manifest: {
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
        timeline: number;
        key?: { method: string; uri?: string; iv?: string };
        map?: { uri: string; byterange?: { length: number; offset: number } };
        byterange?: { length: number; offset: number };
        [key: string]: any;
      }>;
      targetDuration?: number;
      endList?: boolean;
      playlistType?: string;
      version?: number;
      totalDuration?: number;
      discontinuityStarts?: number[];
      mediaSequence?: number;
      [key: string]: any;
    };
  }
}
