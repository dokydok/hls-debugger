import type { SegmentInfo } from '../lib/types';

interface Props {
  segments: SegmentInfo[];
  targetDuration?: number;
}

const MAX_DISPLAY = 500;

export function SegmentList({ segments, targetDuration }: Props) {
  if (segments.length === 0) {
    return <p className="text-dim">No segments in this playlist.</p>;
  }

  const display = segments.slice(0, MAX_DISPLAY);
  const truncated = segments.length > MAX_DISPLAY;

  return (
    <div>
      {truncated && (
        <p className="text-dim" style={{ marginBottom: 8 }}>
          Showing {MAX_DISPLAY} of {segments.length} segments
        </p>
      )}
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Duration</th>
              <th>URI</th>
              <th>Key</th>
              <th>TL</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {display.map((seg) => {
              const warn = targetDuration != null && seg.duration > targetDuration;
              return (
                <tr key={seg.index}>
                  <td>{seg.index}</td>
                  <td className={warn ? 'cell--warn' : ''}>{seg.duration.toFixed(3)}s</td>
                  <td className="truncate" title={seg.uri}>{fileName(seg.uri)}</td>
                  <td>{seg.key ? <span className="badge badge--encrypted">{seg.key.method}</span> : '—'}</td>
                  <td>{seg.timeline}</td>
                  <td className="segment-flags">
                    {seg.discontinuity && <span className="badge badge--event">DISC</span>}
                    {seg.cueOut && <span className="badge badge--live">CUE-OUT</span>}
                    {seg.cueIn && <span className="badge badge--vod">CUE-IN</span>}
                    {seg.byterange && <span className="badge badge--default">BR</span>}
                    {seg.map && <span className="badge badge--default">MAP</span>}
                    {seg.partsCount != null && seg.partsCount > 0 && (
                      <span className="badge badge--info">LL:{seg.partsCount}</span>
                    )}
                    {seg.dateTimeString && <span className="badge badge--default">PDT</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fileName(uri: string): string {
  try {
    const path = new URL(uri).pathname;
    return path.split('/').pop() || uri;
  } catch {
    return uri.split('/').pop() || uri;
  }
}
