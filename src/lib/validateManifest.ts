import type { ParsedManifest, ManifestIssue } from './types';

export function validateManifest(manifest: ParsedManifest): ManifestIssue[] {
  const issues: ManifestIssue[] = [];

  // ── Errors ──

  if (manifest.targetDuration != null && manifest.segmentAnalysis) {
    const exceeding = manifest.segmentAnalysis.segmentsExceedingTarget;
    if (exceeding.length > 0) {
      issues.push({
        severity: 'error',
        code: 'SEGMENT_EXCEEDS_TARGET',
        message: `${exceeding.length} segment(s) exceed target duration of ${manifest.targetDuration}s`,
        details: `Indices: ${exceeding.slice(0, 10).join(', ')}${exceeding.length > 10 ? '…' : ''}`,
      });
    }
  }

  if (!manifest.isMaster && manifest.playlistType === 'VOD' && !manifest.endList) {
    issues.push({
      severity: 'error',
      code: 'VOD_MISSING_ENDLIST',
      message: 'VOD playlist is missing EXT-X-ENDLIST',
    });
  }

  if (!manifest.isMaster && manifest.segments.length > 0 && manifest.targetDuration == null) {
    issues.push({
      severity: 'error',
      code: 'MISSING_TARGET_DURATION',
      message: 'Media playlist is missing EXT-X-TARGETDURATION',
    });
  }

  if (manifest.encryption.isEncrypted) {
    for (const key of manifest.encryption.uniqueKeys) {
      if (key.method !== 'NONE' && !key.uri) {
        issues.push({
          severity: 'error',
          code: 'KEY_MISSING_URI',
          message: `Encryption method ${key.method} specified without a key URI`,
        });
      }
    }
  }

  // ── Warnings ──

  if (!manifest.isMaster && manifest.segments.length > 0 && manifest.version == null) {
    issues.push({
      severity: 'warning',
      code: 'MISSING_VERSION',
      message: 'Playlist is missing EXT-X-VERSION',
    });
  }

  if (manifest.isMaster && manifest.variants.length > 1) {
    const withRes = manifest.variants.filter(v => v.resolution);
    if (withRes.length > 1) {
      const sorted = [...withRes].sort((a, b) => a.bandwidth - b.bandwidth);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1].resolution!;
        const curr = sorted[i].resolution!;
        if (curr.width * curr.height < prev.width * prev.height) {
          issues.push({
            severity: 'warning',
            code: 'BANDWIDTH_RESOLUTION_MISMATCH',
            message: 'Higher bandwidth variant has lower resolution than a lower bandwidth variant',
            details: `${sorted[i].bandwidth} bps (${curr.width}×${curr.height}) vs ${sorted[i - 1].bandwidth} bps (${prev.width}×${prev.height})`,
          });
          break;
        }
      }
    }
  }

  if (manifest.isMaster && manifest.variants.length > 1) {
    const seen = new Set<string>();
    for (const v of manifest.variants) {
      const key = `${v.bandwidth}|${v.resolution?.width ?? 0}x${v.resolution?.height ?? 0}`;
      if (seen.has(key)) {
        issues.push({
          severity: 'warning',
          code: 'DUPLICATE_RENDITION',
          message: `Duplicate rendition: ${v.resolution ? `${v.resolution.width}×${v.resolution.height}` : 'audio-only'} @ ${v.bandwidth} bps`,
        });
        break;
      }
      seen.add(key);
    }
  }

  if (manifest.isMaster) {
    const audioGroupIds = new Set(manifest.audioGroups.map(g => g.groupId));
    const subtitleGroupIds = new Set(manifest.subtitleGroups.map(g => g.groupId));
    for (const v of manifest.variants) {
      if (v.audioGroup && !audioGroupIds.has(v.audioGroup)) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_AUDIO_GROUP',
          message: `Variant references audio group "${v.audioGroup}" which is not defined`,
        });
        break;
      }
      if (v.subtitleGroup && !subtitleGroupIds.has(v.subtitleGroup)) {
        issues.push({
          severity: 'warning',
          code: 'MISSING_SUBTITLE_GROUP',
          message: `Variant references subtitle group "${v.subtitleGroup}" which is not defined`,
        });
        break;
      }
    }
  }

  if (manifest.segmentAnalysis && manifest.targetDuration) {
    const { durationStdDev } = manifest.segmentAnalysis;
    if (durationStdDev > manifest.targetDuration * 0.2) {
      issues.push({
        severity: 'warning',
        code: 'HIGH_DURATION_VARIANCE',
        message: `Segment duration variance is high (stddev ${durationStdDev.toFixed(2)}s)`,
        details: `Target: ${manifest.targetDuration}s, range: ${manifest.segmentAnalysis.minDuration.toFixed(2)}s – ${manifest.segmentAnalysis.maxDuration.toFixed(2)}s`,
      });
    }
  }

  if (manifest.liveStream?.isLive && manifest.segmentAnalysis && !manifest.segmentAnalysis.pdtRange) {
    issues.push({
      severity: 'warning',
      code: 'LIVE_MISSING_PDT',
      message: 'Live stream is missing EXT-X-PROGRAM-DATE-TIME (recommended for synchronization)',
    });
  }

  if (manifest.liveStream?.isDVR && manifest.liveStream.windowDuration < 30) {
    issues.push({
      severity: 'warning',
      code: 'DVR_WINDOW_SHORT',
      message: `DVR window is very short (${manifest.liveStream.windowDuration.toFixed(1)}s) — may cause buffering on seek`,
    });
  }

  if (manifest.liveStream?.isLive && !manifest.liveStream.isDVR && manifest.liveStream.windowSegmentCount < 3) {
    issues.push({
      severity: 'warning',
      code: 'LIVE_FEW_SEGMENTS',
      message: `Rolling window has only ${manifest.liveStream.windowSegmentCount} segment(s) (spec recommends ≥ 3)`,
    });
  }

  if (manifest.liveStream?.isLive && !manifest.raw.includes('#EXT-X-MEDIA-SEQUENCE')) {
    issues.push({
      severity: 'warning',
      code: 'LIVE_MISSING_MEDIA_SEQUENCE',
      message: 'Live stream is missing EXT-X-MEDIA-SEQUENCE (defaults to 0, may cause sync issues)',
    });
  }

  // ── Info ──

  if (manifest.encryption.keyRotationCount > 1) {
    issues.push({
      severity: 'info',
      code: 'KEY_ROTATION',
      message: `Key rotation detected: ${manifest.encryption.keyRotationCount} distinct keys used`,
    });
  }

  if ((manifest.discontinuityCount ?? 0) > 0) {
    issues.push({
      severity: 'info',
      code: 'DISCONTINUITY',
      message: `${manifest.discontinuityCount} discontinuity marker(s) present`,
    });
  }

  if (manifest.segmentAnalysis && (manifest.segmentAnalysis.cueOutCount > 0 || manifest.segmentAnalysis.cueInCount > 0)) {
    issues.push({
      severity: 'info',
      code: 'CUE_MARKERS',
      message: `Ad insertion markers: ${manifest.segmentAnalysis.cueOutCount} CUE-OUT, ${manifest.segmentAnalysis.cueInCount} CUE-IN`,
    });
  }

  if (manifest.lowLatency.hasLowLatency) {
    issues.push({
      severity: 'info',
      code: 'LOW_LATENCY',
      message: 'Low-latency HLS features detected',
    });
  }

  return issues;
}
