import { useRef, useMemo } from 'react';

export interface FragLoadEntry {
  sn: number | string;
  level: number;
  url: string;
  duration: number;
  loadStartTime: number;   // performance.now() relative
  firstByteTime: number;
  loadEndTime: number;
  bytes: number;
  totalBytes: number;
  aborted: boolean;
}

interface Props {
  entries: FragLoadEntry[];
}

export function NetworkWaterfall({ entries }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { rows, timeMin, timeMax } = useMemo(() => {
    if (entries.length === 0) return { rows: [], timeMin: 0, timeMax: 1 };

    const sorted = [...entries].sort((a, b) => a.loadStartTime - b.loadStartTime);
    const tMin = sorted[0].loadStartTime;
    const tMax = Math.max(...sorted.map(e => e.loadEndTime));

    return { rows: sorted, timeMin: tMin, timeMax: tMax };
  }, [entries]);

  if (entries.length === 0) {
    return <p className="text-dim">No fragment loads recorded yet. Start playback to see the waterfall.</p>;
  }

  const timeSpan = timeMax - timeMin || 1;
  const chartWidth = 100; // percentage

  return (
    <div className="waterfall" ref={containerRef}>
      {/* Time axis */}
      <div className="waterfall__axis">
        <span style={{ left: 0 }}>0s</span>
        <span style={{ left: '25%' }}>{((timeSpan * 0.25) / 1000).toFixed(1)}s</span>
        <span style={{ left: '50%' }}>{((timeSpan * 0.5) / 1000).toFixed(1)}s</span>
        <span style={{ left: '75%' }}>{((timeSpan * 0.75) / 1000).toFixed(1)}s</span>
        <span style={{ right: 0 }}>{(timeSpan / 1000).toFixed(1)}s</span>
      </div>

      {/* Rows */}
      <div className="waterfall__rows">
        {rows.map((entry, i) => {
          const startPct = ((entry.loadStartTime - timeMin) / timeSpan) * chartWidth;
          const firstBytePct = ((entry.firstByteTime - timeMin) / timeSpan) * chartWidth;
          const endPct = ((entry.loadEndTime - timeMin) / timeSpan) * chartWidth;
          const loadDuration = entry.loadEndTime - entry.loadStartTime;
          const ttfb = entry.firstByteTime - entry.loadStartTime;
          const speed = loadDuration > 0 ? (entry.bytes / (loadDuration / 1000)) : 0;

          const label = typeof entry.sn === 'number'
            ? `#${entry.sn} L${entry.level}`
            : `init L${entry.level}`;

          return (
            <div
              key={`${entry.sn}-${entry.level}-${i}`}
              className="waterfall__row"
              title={[
                label,
                `Duration: ${loadDuration.toFixed(0)}ms`,
                `TTFB: ${ttfb.toFixed(0)}ms`,
                `Size: ${formatBytes(entry.bytes)}`,
                `Speed: ${formatBytes(speed)}/s`,
                entry.aborted ? '(ABORTED)' : '',
              ].filter(Boolean).join('\n')}
            >
              <span className="waterfall__label">{label}</span>
              <div className="waterfall__track">
                {/* TTFB (waiting) */}
                <div
                  className="waterfall__bar waterfall__bar--ttfb"
                  style={{
                    left: `${startPct}%`,
                    width: `${Math.max(firstBytePct - startPct, 0.2)}%`,
                  }}
                />
                {/* Download */}
                <div
                  className={`waterfall__bar waterfall__bar--download ${entry.aborted ? 'waterfall__bar--aborted' : ''}`}
                  style={{
                    left: `${firstBytePct}%`,
                    width: `${Math.max(endPct - firstBytePct, 0.2)}%`,
                  }}
                />
                {/* Size indicator */}
                <span
                  className="waterfall__size"
                  style={{ left: `${endPct + 0.5}%` }}
                >
                  {formatBytes(entry.bytes)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="waterfall__summary">
        <span>{entries.length} fragments</span>
        <span>{formatBytes(entries.reduce((s, e) => s + e.bytes, 0))} total</span>
        <span>avg {(entries.reduce((s, e) => s + (e.loadEndTime - e.loadStartTime), 0) / entries.length).toFixed(0)}ms / frag</span>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}
