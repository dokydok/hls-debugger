import type { DateRangeInfo } from '../lib/types';

interface Props {
  dateRanges: DateRangeInfo[];
}

export function DateRangeList({ dateRanges }: Props) {
  if (dateRanges.length === 0) return null;

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th title="EXT-X-DATERANGE ID attribute; uniquely identifies this date range">ID</th>
            <th title="CLASS attribute; groups related date ranges (e.g. ad breaks)">Class</th>
            <th title="START-DATE; wall-clock time when this date range begins">Start</th>
            <th title="DURATION or PLANNED-DURATION in seconds">Duration</th>
            <th title="SCTE-35 splice commands embedded in this date range">SCTE-35</th>
          </tr>
        </thead>
        <tbody>
          {dateRanges.map((dr, i) => (
            <tr key={i}>
              <td>{dr.id}</td>
              <td>{dr.class || '—'}</td>
              <td className="truncate" title={dr.startDate}>
                {dr.startDate ? formatTimestamp(dr.startDate) : '—'}
              </td>
              <td>
                {dr.duration != null
                  ? `${dr.duration}s`
                  : dr.plannedDuration != null
                    ? `~${dr.plannedDuration}s`
                    : '—'}
              </td>
              <td>
                {dr.scte35Out && <span className="badge badge--live" title="SCTE35-OUT splice insert; marks start of ad break">OUT</span>}
                {dr.scte35In && <span className="badge badge--vod" title="SCTE35-IN splice insert; marks end of ad break">IN</span>}
                {dr.scte35Cmd && <span className="badge badge--default" title="SCTE35-CMD raw splice command">CMD</span>}
                {!dr.scte35Out && !dr.scte35In && !dr.scte35Cmd && '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
