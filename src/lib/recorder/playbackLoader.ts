import JSZip from 'jszip';
import { parseManifest } from '../parseManifest';
import type { ParsedManifest } from '../types';

export interface RecordingPlayback {
  masterBlobUrl: string;
  manifest: ParsedManifest;
  subManifestCache: Record<string, string>;
  cleanup: () => void;
}

/**
 * Load a recording ZIP for local playback via blob URLs.
 *
 * Extracts all files, creates blob URLs for binary assets,
 * then rewrites M3U8 playlists to reference those blob URLs.
 */
export async function loadRecordingForPlayback(zipFile: File): Promise<RecordingPlayback> {
  const zip = await JSZip.loadAsync(zipFile);
  const blobUrls: string[] = [];

  // 1. Build a map of all files: relativePath -> content
  const fileMap = new Map<string, ArrayBuffer | string>();
  const m3u8Files: string[] = [];

  const entries = Object.entries(zip.files).filter(([, f]) => !f.dir);

  for (const [path, file] of entries) {
    if (path.endsWith('.m3u8')) {
      const text = await file.async('text');
      fileMap.set(path, text);
      m3u8Files.push(path);
    } else if (path === 'recording-info.json') {
      const text = await file.async('text');
      fileMap.set(path, text);
    } else {
      const data = await file.async('arraybuffer');
      fileMap.set(path, data);
    }
  }

  // 2. Create blob URLs for all non-M3U8 files
  const blobUrlMap = new Map<string, string>();

  for (const [path, content] of fileMap) {
    if (path.endsWith('.m3u8') || path === 'recording-info.json') continue;

    const mimeType = guessMimeType(path);
    const blob = new Blob([content as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    blobUrls.push(url);
    blobUrlMap.set(path, url);
  }

  // 3. Process M3U8 files bottom-up (media playlists first, then master)
  //    Sort so deeper paths come first (media playlists are in subdirectories)
  const sortedM3u8 = [...m3u8Files].sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthB - depthA; // deeper first
  });

  const subManifestCache: Record<string, string> = {};

  for (const m3u8Path of sortedM3u8) {
    const originalText = fileMap.get(m3u8Path) as string;
    const dir = m3u8Path.includes('/') ? m3u8Path.slice(0, m3u8Path.lastIndexOf('/')) : '';

    // Replace each referenced file with its blob URL
    const rewritten = originalText.replace(
      /^(?!#)(\S+)$/gm,
      (match) => {
        const resolvedPath = dir ? `${dir}/${match}` : match;
        return blobUrlMap.get(resolvedPath) ?? match;
      },
    );

    // Also rewrite URI="..." attributes in tags (EXT-X-MAP, EXT-X-KEY, etc.)
    const rewrittenTags = rewritten.replace(
      /URI="([^"]+)"/g,
      (_full, uri: string) => {
        const resolvedPath = dir ? `${dir}/${uri}` : uri;
        const blobUrl = blobUrlMap.get(resolvedPath);
        return blobUrl ? `URI="${blobUrl}"` : _full;
      },
    );

    // Create blob URL for this playlist
    const m3u8Blob = new Blob([rewrittenTags], { type: 'application/vnd.apple.mpegurl' });
    const m3u8Url = URL.createObjectURL(m3u8Blob);
    blobUrls.push(m3u8Url);
    blobUrlMap.set(m3u8Path, m3u8Url);

    // Store in sub-manifest cache (non-master playlists)
    const rootName = m3u8Path === 'master.m3u8' || m3u8Path === 'playlist.m3u8'
      ? null : m3u8Path;
    if (rootName) {
      subManifestCache[m3u8Url] = rewrittenTags;
    }
  }

  // 4. Find the entry-point playlist (master.m3u8 or playlist.m3u8 for single-track)
  const entryBlobUrl = blobUrlMap.get('master.m3u8') ?? blobUrlMap.get('playlist.m3u8');
  if (!entryBlobUrl) {
    throw new Error('Recording ZIP does not contain a master.m3u8 or playlist.m3u8 file');
  }

  // Re-read the entry text (with blob URLs) for parsing
  const entryText = await (await fetch(entryBlobUrl)).text();
  const manifest = parseManifest(entryText, entryBlobUrl);

  const cleanup = () => {
    for (const url of blobUrls) {
      URL.revokeObjectURL(url);
    }
  };

  return { masterBlobUrl: entryBlobUrl, manifest, subManifestCache, cleanup };
}

function guessMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts': return 'video/mp2t';
    case 'mp4':
    case 'm4s':
    case 'm4v': return 'video/mp4';
    case 'm4a':
    case 'aac': return 'audio/mp4';
    case 'mp3': return 'audio/mpeg';
    case 'vtt':
    case 'webvtt': return 'text/vtt';
    case 'key': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}
