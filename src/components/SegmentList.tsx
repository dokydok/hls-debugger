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
  const hasPdt = segments.some(s => s.dateTimeString);
  const hasScte = segments.some(s => s.cueOut || s.cueIn || s.cueOutCont);

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
              <th title="Segment index in the playlist">#</th>
              <th title="EXTINF duration of this segment in seconds">Duration</th>
              <th title="Segment media file URL">URI</th>
              <th title="EXT-X-KEY encryption method applied to this segment">Key</th>
              <th title="Timeline index; changes at discontinuity boundaries">TL</th>
              {hasPdt && <th title="EXT-X-PROGRAM-DATE-TIME; wall-clock time for this segment">PDT</th>}
              {hasScte && <th title="SCTE-35 ad insertion markers (CUE-OUT / CUE-IN)">SCTE</th>}
              <th title="DISC=discontinuity, BR=byte-range, MAP=init segment, LL=low-latency parts">Flags</th>
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
                  {hasPdt && (
                    <td className="truncate" title={seg.dateTimeString}>
                      {seg.dateTimeString ? formatTimestamp(seg.dateTimeString) : '—'}
                    </td>
                  )}
                  {hasScte && (
                    <td className="segment-flags">
                      {seg.cueOut && <span className="badge badge--live" title={`CUE-OUT: ${seg.cueOut}`}>OUT</span>}
                      {seg.cueOutCont && <span className="badge badge--event" title={`CUE-OUT-CONT: ${seg.cueOutCont}`}>CONT</span>}
                      {seg.cueIn && <span className="badge badge--vod" title="CUE-IN: ad break ends">IN</span>}
                      {!seg.cueOut && !seg.cueOutCont && !seg.cueIn && '—'}
                    </td>
                  )}
                  <td className="segment-flags">
                    {seg.discontinuity && <span className="badge badge--event" title="Discontinuity boundary — codec or timestamp change">DISC</span>}
                    {seg.byterange && <span className="badge badge--default" title="Byte-range sub-segment within a larger file">BR</span>}
                    {seg.map && <span className="badge badge--default" title="EXT-X-MAP initialization segment (fMP4/CMAF)">MAP</span>}
                    {seg.partsCount != null && seg.partsCount > 0 && (
                      <span className="badge badge--info" title={`Low-latency HLS: ${seg.partsCount} partial segments`}>LL:{seg.partsCount}</span>
                    )}
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

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  } catch {
    return iso;
  }
}
