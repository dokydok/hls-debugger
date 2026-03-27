import JSZip from 'jszip';
import type { RecordingSession } from './types';
import { rewriteMediaPlaylist, rewriteMasterPlaylist } from './manifestRewriter';

export async function buildRecordingZip(session: RecordingSession): Promise<Blob> {
  const zip = new JSZip();

  const tracksWithSegments = Array.from(session.tracks.values()).filter(ts => ts.segments.length > 0);
  const isSingleTrack = tracksWithSegments.length === 1 && !session.masterManifestText.includes('#EXT-X-STREAM-INF');

  if (isSingleTrack) {
    // Single media playlist — put playlist and segments at root
    const ts = tracksWithSegments[0];
    const playlistText = rewriteMediaPlaylist(ts);
    zip.file('playlist.m3u8', playlistText);

    for (const seg of ts.segments) {
      zip.file(seg.localFilename, seg.data);
    }
    for (const [, init] of ts.initSegments) {
      zip.file(init.localFilename, init.data);
    }
    for (const [, key] of ts.keys) {
      zip.file(key.localFilename, key.data);
    }
  } else {
    // Master + multiple tracks
    const masterText = rewriteMasterPlaylist(session);
    zip.file('master.m3u8', masterText);

    for (const ts of tracksWithSegments) {
      const folder = ts.track.folderPath;
      const playlistText = rewriteMediaPlaylist(ts);
      zip.file(`${folder}/playlist.m3u8`, playlistText);

      for (const seg of ts.segments) {
        zip.file(`${folder}/${seg.localFilename}`, seg.data);
      }
      for (const [, init] of ts.initSegments) {
        zip.file(`${folder}/${init.localFilename}`, init.data);
      }
      for (const [, key] of ts.keys) {
        zip.file(`${folder}/${key.localFilename}`, key.data);
      }
    }
  }

  // Add recording metadata
  const totalDuration = Array.from(session.tracks.values()).reduce(
    (max, ts) => {
      const d = ts.segments.reduce((sum, s) => sum + s.duration, 0);
      return Math.max(max, d);
    },
    0,
  );

  const info = {
    schemaVersion: 1,
    recordedAt: new Date(session.startedAt).toISOString(),
    duration: totalDuration,
    masterUrl: session.masterUrl,
    tracks: Array.from(session.tracks.values())
      .filter(ts => ts.segments.length > 0)
      .map(ts => ({
        type: ts.track.type,
        label: ts.track.label,
        folder: ts.track.folderPath,
        segmentCount: ts.segments.length,
        bytes: ts.segments.reduce((sum, s) => sum + s.data.byteLength, 0),
      })),
    totalBytes: session.totalBytes,
    segmentCount: session.segmentCount,
  };
  zip.file('recording-info.json', JSON.stringify(info, null, 2));

  return zip.generateAsync({ type: 'blob' });
}
