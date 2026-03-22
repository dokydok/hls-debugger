import type { ParsedManifest } from './types';

export interface HlsDebuggerSnapshotV1 {
  schemaVersion: 1;
  exportedAt: string;
  masterUrl: string;
  masterPlaylistText: string;
  activePlaybackUrl: string | null;
  mediaPlaylist?: { url: string; text: string } | null;
  subManifests?: Record<string, string>;
}

export interface AppSnapshotState {
  manifest: ParsedManifest;
  masterUrl: string;
  activeUrl: string | null;
  mediaManifest: ParsedManifest | null;
  subManifestCache: Record<string, string>;
}

export function buildSnapshot(state: AppSnapshotState): HlsDebuggerSnapshotV1 {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    masterUrl: state.masterUrl,
    masterPlaylistText: state.manifest.raw,
    activePlaybackUrl: state.activeUrl,
    mediaPlaylist: state.mediaManifest
      ? { url: state.mediaManifest.url, text: state.mediaManifest.raw }
      : null,
    subManifests: Object.keys(state.subManifestCache).length > 0
      ? state.subManifestCache
      : undefined,
  };
}

export function parseSnapshot(json: unknown): HlsDebuggerSnapshotV1 {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Snapshot file does not contain a valid JSON object.');
  }

  const obj = json as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    throw new Error(
      `Unsupported snapshot version: ${String(obj.schemaVersion ?? 'missing')}. Expected 1.`,
    );
  }

  if (typeof obj.masterUrl !== 'string' || !obj.masterUrl) {
    throw new Error('Snapshot is missing a valid masterUrl.');
  }

  if (typeof obj.masterPlaylistText !== 'string' || !obj.masterPlaylistText) {
    throw new Error('Snapshot is missing masterPlaylistText.');
  }

  const activePlaybackUrl =
    typeof obj.activePlaybackUrl === 'string' ? obj.activePlaybackUrl : null;

  let mediaPlaylist: HlsDebuggerSnapshotV1['mediaPlaylist'] = null;
  if (obj.mediaPlaylist && typeof obj.mediaPlaylist === 'object') {
    const mp = obj.mediaPlaylist as Record<string, unknown>;
    if (typeof mp.url === 'string' && typeof mp.text === 'string') {
      mediaPlaylist = { url: mp.url, text: mp.text };
    }
  }

  let subManifests: Record<string, string> | undefined;
  if (obj.subManifests && typeof obj.subManifests === 'object') {
    const sm = obj.subManifests as Record<string, unknown>;
    const valid: Record<string, string> = {};
    for (const [k, v] of Object.entries(sm)) {
      if (typeof v === 'string') valid[k] = v;
    }
    if (Object.keys(valid).length > 0) subManifests = valid;
  }

  return {
    schemaVersion: 1,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    masterUrl: obj.masterUrl as string,
    masterPlaylistText: obj.masterPlaylistText as string,
    activePlaybackUrl,
    mediaPlaylist,
    subManifests,
  };
}

export function downloadSnapshot(snapshot: HlsDebuggerSnapshotV1): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `hls-debugger-snapshot-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
