import type { SegmentAnalysis as SegmentAnalysisType, LiveStreamInfo } from '../lib/types';

interface Props {
  analysis: SegmentAnalysisType;
  targetDuration?: number;
  liveStream?: LiveStreamInfo;
}

export function SegmentAnalysis({ analysis, targetDuration, liveStream }: Props) {
  return (
    <div>
      {liveStream?.isLive && (
        <div className="live-info">
          <span className={`badge badge--${liveStream.isEvent ? 'event' : liveStream.isDVR ? 'dvr' : 'live'}`}>
            {liveStream.isEvent ? 'EVENT' : liveStream.isDVR ? 'LIVE DVR' : 'LIVE'}
          </span>

          <div className="summary-grid" style={{ marginTop: 12 }}>
            <Item label="Window" value={`${formatDuration(liveStream.windowDuration)} (${liveStream.windowSegmentCount} segs)`} tooltip="Total duration of segments currently in the live playlist window" />
            <Item label="Sequence" value={String(liveStream.mediaSequence)} tooltip="EXT-X-MEDIA-SEQUENCE; position of the first segment in the overall timeline" />
            {liveStream.suggestedPollInterval != null && (
              <Item label="Poll Interval" value={`${liveStream.suggestedPollInterval}s`} tooltip="How often the player should re-fetch this playlist for updates" />
            )}
            {liveStream.estimatedLiveEdge && (
              <Item label="Live Edge" value={formatTimestamp(liveStream.estimatedLiveEdge)} tooltip="Estimated real-time position of the stream (from last segment's PDT + duration)" />
            )}
          </div>
        </div>
      )}

      <div className="summary-grid" style={liveStream?.isLive ? { marginTop: 16 } : undefined}>
        <Item label="Min Duration" value={`${analysis.minDuration.toFixed(2)}s`} tooltip="Shortest segment duration across all segments" />
        <Item label="Max Duration" value={`${analysis.maxDuration.toFixed(2)}s`} tooltip="Longest segment duration across all segments" />
        <Item label="Avg Duration" value={`${analysis.avgDuration.toFixed(2)}s`} tooltip="Average segment duration across all segments" />
        {targetDuration != null && (
          <div className="summary-item">
            <span className="summary-item__label" title="Whether all segments respect EXT-X-TARGETDURATION">Target Compliance</span>
            <span className="summary-item__value">
              {analysis.targetDurationCompliant ? (
                <span className="badge badge--vod">All OK</span>
              ) : (
                <span className="badge badge--live">{analysis.segmentsExceedingTarget.length} exceed</span>
              )}
            </span>
          </div>
        )}
        <Item label="Total Duration" value={formatDuration(analysis.totalDuration)} tooltip="Sum of all segment durations" />
        <Item label="Std Dev" value={`${analysis.durationStdDev.toFixed(3)}s`} tooltip="Standard deviation of segment durations; high values indicate inconsistent chunking" />
      </div>

      <div className="summary-grid" style={{ marginTop: 12 }}>
        <Item label="Timelines" value={String(analysis.timelineCount)} tooltip="Number of distinct timeline groups separated by discontinuities" />
        {analysis.byteRangeSegmentCount > 0 && (
          <Item label="Byte Range Segments" value={String(analysis.byteRangeSegmentCount)} tooltip="Segments using EXT-X-BYTERANGE for sub-file addressing" />
        )}
        <div className="summary-item">
          <span className="summary-item__label" title="EXT-X-MAP initialization segment for fMP4/CMAF">Init Segment</span>
          <span className="summary-item__value">
            {analysis.hasInitSegment ? (
              <span className="badge badge--vod">Present</span>
            ) : (
              <span className="text-dim">None</span>
            )}
          </span>
        </div>
        {(analysis.cueOutCount > 0 || analysis.cueInCount > 0) && (
          <Item label="CUE Markers" value={`${analysis.cueOutCount} out / ${analysis.cueInCount} in`} tooltip="SCTE-35 ad insertion markers (CUE-OUT starts ad break, CUE-IN ends ad break)" />
        )}
        {analysis.pdtRange && (
          <Item label="PDT Range" value={`${formatTimestamp(analysis.pdtRange.first)} — ${formatTimestamp(analysis.pdtRange.last)}`} tooltip="EXT-X-PROGRAM-DATE-TIME range from first to last segment" />
        )}
      </div>
    </div>
  );
}

function Item({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label" title={tooltip}>{label}</span>
      <span className="summary-item__value">{value}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
