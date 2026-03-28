import { useMemo } from 'react';
import type { SegmentInfo } from '../lib/types';
import { analyzeAdBreaks } from '../lib/analyzeAdBreaks';

interface Props {
  segments: SegmentInfo[];
}

export function AdBreakAnalyzer({ segments }: Props) {
  const analysis = useMemo(() => analyzeAdBreaks(segments), [segments]);

  if (analysis.breaks.length === 0) {
    return <p className="text-dim">No ad breaks detected.</p>;
  }

  const { breaks, totalAdTime, totalPlaylistDuration } = analysis;
  const adPercent = totalPlaylistDuration > 0
    ? ((totalAdTime / totalPlaylistDuration) * 100).toFixed(1)
    : '0';

  return (
    <div className="ad-break-analyzer">
      {/* Summary */}
      <div className="ad-break-summary">
        <div className="ad-break-stat">
          <span className="ad-break-stat__value">{analysis.totalBreaks}</span>
          <span className="ad-break-stat__label">break{analysis.totalBreaks !== 1 ? 's' : ''}</span>
        </div>
        <div className="ad-break-stat">
          <span className="ad-break-stat__value">{formatDuration(totalAdTime)}</span>
          <span className="ad-break-stat__label">ad time ({adPercent}%)</span>
        </div>
        {analysis.unpairedCueOuts > 0 && (
          <span className="badge badge--live">{analysis.unpairedCueOuts} unclosed</span>
        )}
        {analysis.orphanCueIns > 0 && (
          <span className="badge badge--live">{analysis.orphanCueIns} orphan CUE-IN</span>
        )}
        {analysis.durationMismatches > 0 && (
          <span className="badge badge--event">{analysis.durationMismatches} duration mismatch</span>
        )}
      </div>

      {/* Timeline */}
      {totalPlaylistDuration > 0 && (
        <div className="ad-break-timeline" title="Ad break positions in the playlist">
          {breaks.map(b => {
            const left = (b.startTime / totalPlaylistDuration) * 100;
            const width = Math.max(
              ((b.actualDuration ?? 0) / totalPlaylistDuration) * 100,
              0.5,
            );
            return (
              <div
                key={b.index}
                className={`ad-break-timeline__region ${!b.isPaired ? 'ad-break-timeline__region--unclosed' : ''}`}
                style={{ left: `${left}%`, width: `${width}%` }}
                title={`Break #${b.index + 1}: ${formatDuration(b.startTime)} — ${b.endTime != null ? formatDuration(b.endTime) : '?'}`}
              />
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="data-table-wrapper" style={{ marginTop: 10 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Start</th>
              <th>End</th>
              <th>Declared</th>
              <th>Actual</th>
              <th>Segs</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {breaks.map(b => (
              <tr key={b.index}>
                <td>{b.index + 1}</td>
                <td>{formatDuration(b.startTime)}</td>
                <td>{b.endTime != null ? formatDuration(b.endTime) : '—'}</td>
                <td>{b.declaredDuration != null ? `${b.declaredDuration.toFixed(1)}s` : '—'}</td>
                <td>{b.actualDuration != null ? `${b.actualDuration.toFixed(1)}s` : '—'}</td>
                <td>{b.segmentCount}</td>
                <td>
                  {b.isPaired && !b.hasDurationMismatch && (
                    <span className="badge badge--vod">Paired</span>
                  )}
                  {b.isPaired && b.hasDurationMismatch && (
                    <span className="badge badge--event">Mismatch</span>
                  )}
                  {!b.isPaired && (
                    <span className="badge badge--live">Unclosed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
