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
            <Item label="Window" value={`${formatDuration(liveStream.windowDuration)} (${liveStream.windowSegmentCount} segs)`} />
            <Item label="Sequence" value={String(liveStream.mediaSequence)} />
            {liveStream.suggestedPollInterval != null && (
              <Item label="Poll Interval" value={`${liveStream.suggestedPollInterval}s`} />
            )}
            {liveStream.estimatedLiveEdge && (
              <Item label="Live Edge" value={formatTimestamp(liveStream.estimatedLiveEdge)} />
            )}
          </div>
        </div>
      )}

      <div className="summary-grid" style={liveStream?.isLive ? { marginTop: 16 } : undefined}>
        <Item label="Min Duration" value={`${analysis.minDuration.toFixed(2)}s`} />
        <Item label="Max Duration" value={`${analysis.maxDuration.toFixed(2)}s`} />
        <Item label="Avg Duration" value={`${analysis.avgDuration.toFixed(2)}s`} />
        {targetDuration != null && (
          <div className="summary-item">
            <span className="summary-item__label">Target Compliance</span>
            <span className="summary-item__value">
              {analysis.targetDurationCompliant ? (
                <span className="badge badge--vod">All OK</span>
              ) : (
                <span className="badge badge--live">{analysis.segmentsExceedingTarget.length} exceed</span>
              )}
            </span>
          </div>
        )}
        <Item label="Total Duration" value={formatDuration(analysis.totalDuration)} />
        <Item label="Std Dev" value={`${analysis.durationStdDev.toFixed(3)}s`} />
      </div>

      <div className="summary-grid" style={{ marginTop: 12 }}>
        <Item label="Timelines" value={String(analysis.timelineCount)} />
        {analysis.byteRangeSegmentCount > 0 && (
          <Item label="Byte Range Segments" value={String(analysis.byteRangeSegmentCount)} />
        )}
        <div className="summary-item">
          <span className="summary-item__label">Init Segment</span>
          <span className="summary-item__value">
            {analysis.hasInitSegment ? (
              <span className="badge badge--vod">Present</span>
            ) : (
              <span className="text-dim">None</span>
            )}
          </span>
        </div>
        {(analysis.cueOutCount > 0 || analysis.cueInCount > 0) && (
          <Item label="CUE Markers" value={`${analysis.cueOutCount} out / ${analysis.cueInCount} in`} />
        )}
        {analysis.pdtRange && (
          <Item label="PDT Range" value={`${formatTimestamp(analysis.pdtRange.first)} — ${formatTimestamp(analysis.pdtRange.last)}`} />
        )}
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label">{label}</span>
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
