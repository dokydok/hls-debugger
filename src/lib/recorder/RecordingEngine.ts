import type { ParsedManifest } from '../types';
import { parseManifest } from '../parseManifest';
import type {
  RecordingTrack,
  RecordingSession,
  RecordingStats,
  TrackRecordingState,
  RecordedSegment,
} from './types';
import { buildRecordingZip } from './zipBuilder';

const DEFAULT_POLL_INTERVAL = 6;

export class RecordingEngine {
  private session: RecordingSession | null = null;
  private pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private abortController: AbortController | null = null;
  private inFlightCount = 0;
  private onUpdate: (stats: RecordingStats) => void;
  private needsPolling = false;

  constructor(onUpdate: (stats: RecordingStats) => void) {
    this.onUpdate = onUpdate;
  }

  start(masterUrl: string, masterManifestText: string, manifest: ParsedManifest, needsPolling: boolean): void {
    if (this.session?.state === 'recording') return;

    this.abortController = new AbortController();
    this.needsPolling = needsPolling;

    const tracks = this.buildTrackList(manifest);

    const trackStates = new Map<string, TrackRecordingState>();
    for (const track of tracks) {
      trackStates.set(track.id, {
        track,
        segments: [],
        seenSegmentUris: new Set(),
        initSegments: new Map(),
        keys: new Map(),
      });
    }

    this.session = {
      state: 'recording',
      startedAt: Date.now(),
      tracks: trackStates,
      masterManifestText,
      masterUrl,
      totalBytes: 0,
      segmentCount: 0,
      errors: [],
    };

    this.fireUpdate();

    if (this.needsPolling) {
      // Live: start polling each track for new segments
      for (const track of tracks) {
        this.pollTrack(track.id);
      }
    }
    // VOD: nothing to do until stop — segments are downloaded on stop
  }

  async stop(playbackStartTime?: number, playbackStopTime?: number): Promise<Blob> {
    if (!this.session || this.session.state !== 'recording') {
      throw new Error('Not recording');
    }

    this.session.state = 'stopping';
    this.fireUpdate();

    // Cancel future polls (live mode)
    for (const timer of this.pollTimers.values()) {
      clearTimeout(timer);
    }
    this.pollTimers.clear();

    if (this.needsPolling) {
      // Abort in-flight live fetches
      this.abortController?.abort();

      // Wait for any in-flight downloads to settle
      if (this.inFlightCount > 0) {
        await new Promise<void>((resolve) => {
          const check = () => {
            if (this.inFlightCount <= 0) resolve();
            else setTimeout(check, 100);
          };
          check();
        });
      }
    } else {
      // VOD: fetch sub-manifests and download segments within the playback time range
      const startSec = playbackStartTime ?? 0;
      const stopSec = playbackStopTime ?? startSec + (Date.now() - this.session.startedAt) / 1000;
      await this.downloadVodSegments(startSec, stopSec);
    }

    this.session.state = 'processing';
    this.fireUpdate();

    try {
      const blob = await buildRecordingZip(this.session);
      this.session.state = 'idle';
      this.fireUpdate();
      return blob;
    } catch (err) {
      this.session.state = 'idle';
      this.fireUpdate();
      throw err;
    }
  }

  getStats(): RecordingStats | null {
    if (!this.session) return null;
    return this.buildStats();
  }

  destroy(): void {
    for (const timer of this.pollTimers.values()) {
      clearTimeout(timer);
    }
    this.pollTimers.clear();
    this.abortController?.abort();
    this.session = null;
  }

  private async downloadVodSegments(startSec: number, stopSec: number): Promise<void> {
    const session = this.session!;
    const signal = this.abortController?.signal;

    for (const [, ts] of session.tracks) {
      try {
        this.inFlightCount++;

        // Fetch and parse the media playlist
        const resp = await fetch(ts.track.playlistUrl, { signal });
        const text = await resp.text();
        const parsed = parseManifest(text, ts.track.playlistUrl);

        if (ts.targetDuration == null && parsed.targetDuration != null) {
          ts.targetDuration = parsed.targetDuration;
        }
        if (ts.version == null && parsed.version != null) {
          ts.version = parsed.version;
        }

        // Find segments that overlap with [startSec, stopSec]
        // A segment at [segStart, segEnd) overlaps if segEnd > startSec && segStart < stopSec
        let cumulativeTime = 0;
        const mediaSequenceBase = parsed.mediaSequence ?? 0;

        for (let i = 0; i < parsed.segments.length; i++) {
          const seg = parsed.segments[i];
          const segStart = cumulativeTime;
          const segEnd = cumulativeTime + seg.duration;
          cumulativeTime = segEnd;

          // Skip segments entirely before the recording window
          if (segEnd <= startSec) continue;
          // Stop after the recording window
          if (segStart >= stopSec) break;

          const mediaSeq = mediaSequenceBase + i;

          // Download init segment if new
          if (seg.map && !ts.initSegments.has(seg.map.uri)) {
            try {
              const initResp = await fetch(seg.map.uri, { signal });
              const initData = await initResp.arrayBuffer();
              const ext = inferExtension(seg.map.uri, 'mp4');
              ts.initSegments.set(seg.map.uri, {
                uri: seg.map.uri,
                localFilename: `init_${ts.initSegments.size}.${ext}`,
                data: initData,
              });
              session.totalBytes += initData.byteLength;
            } catch {
              if (signal?.aborted) return;
              session.errors.push(`Init segment fetch failed: ${seg.map.uri}`);
            }
          }

          // Download encryption key if new
          if (seg.key?.uri && !ts.keys.has(seg.key.uri)) {
            try {
              const keyResp = await fetch(seg.key.uri, { signal });
              const keyData = await keyResp.arrayBuffer();
              ts.keys.set(seg.key.uri, {
                uri: seg.key.uri,
                localFilename: `key_${ts.keys.size}.key`,
                data: keyData,
              });
              session.totalBytes += keyData.byteLength;
            } catch {
              if (signal?.aborted) return;
              session.errors.push(`Key fetch failed: ${seg.key.uri}`);
            }
          }

          // Download the segment
          try {
            const segResp = await fetch(seg.uri, { signal });
            const segData = await segResp.arrayBuffer();
            const ext = inferExtension(seg.uri, 'ts');
            const segIndex = ts.segments.length;

            const recorded: RecordedSegment = {
              uri: seg.uri,
              localFilename: `seg_${segIndex}.${ext}`,
              data: segData,
              duration: seg.duration,
              mediaSequence: mediaSeq,
              discontinuity: seg.discontinuity,
              programDateTime: seg.programDateTime,
              dateTimeString: seg.dateTimeString,
              timeline: seg.timeline,
              cueOut: seg.cueOut,
              cueOutCont: seg.cueOutCont,
              cueIn: seg.cueIn,
            };

            ts.segments.push(recorded);
            session.totalBytes += segData.byteLength;
            session.segmentCount++;
            this.fireUpdate();
          } catch {
            if (signal?.aborted) return;
            session.errors.push(`Segment fetch failed: ${seg.uri}`);
          }
        }
      } catch (err) {
        if (this.abortController?.signal.aborted) return;
        session.errors.push(`VOD fetch failed for ${ts.track.label}: ${String(err)}`);
      } finally {
        this.inFlightCount--;
      }
    }
  }

  private buildTrackList(manifest: ParsedManifest): RecordingTrack[] {
    const tracks: RecordingTrack[] = [];
    const usedFolders = new Set<string>();

    const makeUnique = (base: string): string => {
      let folder = base;
      let counter = 2;
      while (usedFolders.has(folder)) {
        folder = `${base}_${counter}`;
        counter++;
      }
      usedFolders.add(folder);
      return folder;
    };

    // Non-master manifest: single media playlist loaded directly
    if (!manifest.isMaster) {
      tracks.push({
        id: 'video_media',
        type: 'video',
        label: 'media',
        playlistUrl: manifest.url,
        folderPath: 'video/media',
      });
      return tracks;
    }

    for (const v of manifest.variants) {
      const label = v.resolution
        ? `${v.resolution.height}p`
        : `${Math.round(v.bandwidth / 1000)}k`;
      const folder = makeUnique(`video/${label}`);
      tracks.push({
        id: `video_${folder}`,
        type: 'video',
        label,
        playlistUrl: v.uri,
        folderPath: folder,
      });
    }

    for (const g of manifest.audioGroups) {
      for (const t of g.tracks) {
        if (!t.uri) continue;
        const safeName = sanitizeName(t.name || t.language || g.groupId);
        const folder = makeUnique(`audio/${safeName}`);
        tracks.push({
          id: `audio_${folder}`,
          type: 'audio',
          label: t.name || t.language || g.groupId,
          playlistUrl: t.uri,
          folderPath: folder,
        });
      }
    }

    for (const g of manifest.subtitleGroups) {
      for (const t of g.tracks) {
        if (!t.uri) continue;
        const safeName = sanitizeName(t.name || t.language || g.groupId);
        const folder = makeUnique(`subtitles/${safeName}`);
        tracks.push({
          id: `subtitle_${folder}`,
          type: 'subtitle',
          label: t.name || t.language || g.groupId,
          playlistUrl: t.uri,
          folderPath: folder,
        });
      }
    }

    return tracks;
  }

  private async pollTrack(trackId: string): Promise<void> {
    const session = this.session;
    if (!session || session.state !== 'recording') return;

    const ts = session.tracks.get(trackId);
    if (!ts) return;

    const signal = this.abortController?.signal;
    let pollInterval = DEFAULT_POLL_INTERVAL;

    try {
      this.inFlightCount++;

      // Fetch and parse the media playlist
      const resp = await fetch(ts.track.playlistUrl, { signal });
      const text = await resp.text();
      const parsed = parseManifest(text, ts.track.playlistUrl);

      // Update track metadata from first successful poll
      if (ts.targetDuration == null && parsed.targetDuration != null) {
        ts.targetDuration = parsed.targetDuration;
      }
      if (ts.version == null && parsed.version != null) {
        ts.version = parsed.version;
      }

      pollInterval = parsed.liveStream?.suggestedPollInterval
        ?? parsed.targetDuration
        ?? DEFAULT_POLL_INTERVAL;

      // Download new segments
      const mediaSequenceBase = parsed.mediaSequence ?? 0;
      for (let i = 0; i < parsed.segments.length; i++) {
        const seg = parsed.segments[i];
        const mediaSeq = mediaSequenceBase + i;
        const dedupKey = `${seg.uri}|${mediaSeq}`;

        if (ts.seenSegmentUris.has(dedupKey)) continue;
        ts.seenSegmentUris.add(dedupKey);

        // Download init segment if new
        if (seg.map && !ts.initSegments.has(seg.map.uri)) {
          try {
            const initResp = await fetch(seg.map.uri, { signal });
            const initData = await initResp.arrayBuffer();
            const ext = inferExtension(seg.map.uri, 'mp4');
            ts.initSegments.set(seg.map.uri, {
              uri: seg.map.uri,
              localFilename: `init_${ts.initSegments.size}.${ext}`,
              data: initData,
            });
            session.totalBytes += initData.byteLength;
          } catch {
            if (signal?.aborted) break;
            session.errors.push(`Init segment fetch failed: ${seg.map.uri}`);
          }
        }

        // Download encryption key if new
        if (seg.key?.uri && !ts.keys.has(seg.key.uri)) {
          try {
            const keyResp = await fetch(seg.key.uri, { signal });
            const keyData = await keyResp.arrayBuffer();
            ts.keys.set(seg.key.uri, {
              uri: seg.key.uri,
              localFilename: `key_${ts.keys.size}.key`,
              data: keyData,
            });
            session.totalBytes += keyData.byteLength;
          } catch {
            if (signal?.aborted) break;
            session.errors.push(`Key fetch failed: ${seg.key.uri}`);
          }
        }

        // Download the segment
        try {
          const segResp = await fetch(seg.uri, { signal });
          const segData = await segResp.arrayBuffer();
          const ext = inferExtension(seg.uri, 'ts');
          const segIndex = ts.segments.length;

          const recorded: RecordedSegment = {
            uri: seg.uri,
            localFilename: `seg_${segIndex}.${ext}`,
            data: segData,
            duration: seg.duration,
            mediaSequence: mediaSeq,
            discontinuity: seg.discontinuity,
            programDateTime: seg.programDateTime,
            dateTimeString: seg.dateTimeString,
            timeline: seg.timeline,
            cueOut: seg.cueOut,
            cueOutCont: seg.cueOutCont,
            cueIn: seg.cueIn,
          };

          ts.segments.push(recorded);
          session.totalBytes += segData.byteLength;
          session.segmentCount++;
          this.fireUpdate();
        } catch {
          if (signal?.aborted) break;
          session.errors.push(`Segment fetch failed: ${seg.uri}`);
        }
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return;
      session.errors.push(`Poll failed for ${ts.track.label}: ${String(err)}`);
    } finally {
      this.inFlightCount--;
    }

    // Schedule next poll
    if (session.state === 'recording') {
      const timer = setTimeout(
        () => this.pollTrack(trackId),
        pollInterval * 1000,
      );
      this.pollTimers.set(trackId, timer);
    }
  }

  private buildStats(): RecordingStats {
    const s = this.session!;
    return {
      state: s.state,
      elapsed: Date.now() - s.startedAt,
      segmentCount: s.segmentCount,
      totalBytes: s.totalBytes,
      trackCount: s.tracks.size,
      errors: s.errors,
    };
  }

  private fireUpdate(): void {
    if (this.session) {
      this.onUpdate(this.buildStats());
    }
  }
}

function inferExtension(uri: string, fallback: string): string {
  try {
    const pathname = new URL(uri).pathname;
    const lastDot = pathname.lastIndexOf('.');
    if (lastDot >= 0) {
      const ext = pathname.slice(lastDot + 1).toLowerCase();
      if (['ts', 'mp4', 'm4s', 'm4a', 'm4v', 'aac', 'vtt', 'webvtt', 'mp3'].includes(ext)) {
        return ext;
      }
    }
  } catch {
    // fall through
  }
  return fallback;
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'default';
}
