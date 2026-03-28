import { useMemo } from 'react';
import type { Variant } from '../lib/types';
import { parseCodecs } from '../lib/codecParser';

interface Props {
  variants: Variant[];
}

const CODEC_COLORS: Record<string, string> = {
  'H.264': '#3b82f6',
  'HEVC': '#8b5cf6',
  'AV1': '#10b981',
  'VP9': '#f59e0b',
  'VP8': '#f97316',
};
const DEFAULT_COLOR = '#64748b';

const PADDING = { top: 20, right: 30, bottom: 40, left: 55 };
const CHART_WIDTH = 600;
const CHART_HEIGHT = 280;
const DOT_RADIUS = 6;
const GAP_THRESHOLD = 3; // flag gaps > 3x between adjacent renditions

export function BitrateLadder({ variants }: Props) {
  const data = useMemo(() => {
    return variants.map(v => {
      const codecs = parseCodecs(v.codecs);
      const videoCodec = codecs.find(c => c.type === 'video');
      return {
        variant: v,
        height: v.resolution?.height ?? 0,
        bandwidth: v.bandwidth,
        label: v.resolution
          ? `${v.resolution.height}p`
          : 'Audio',
        bitrateLabel: formatBw(v.bandwidth),
        color: videoCodec ? (CODEC_COLORS[videoCodec.name] ?? DEFAULT_COLOR) : DEFAULT_COLOR,
        codecName: videoCodec?.name ?? 'Unknown',
      };
    }).sort((a, b) => a.bandwidth - b.bandwidth);
  }, [variants]);

  const gaps = useMemo(() => {
    const result: Array<{ from: number; to: number }> = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i].bandwidth / data[i - 1].bandwidth > GAP_THRESHOLD) {
        result.push({ from: i - 1, to: i });
      }
    }
    return result;
  }, [data]);

  const duplicates = useMemo(() => {
    const dupes = new Set<number>();
    for (let i = 0; i < data.length; i++) {
      for (let j = i + 1; j < data.length; j++) {
        if (
          data[i].height === data[j].height &&
          data[i].height > 0 &&
          Math.abs(data[i].bandwidth - data[j].bandwidth) / data[i].bandwidth < 0.1
        ) {
          dupes.add(i);
          dupes.add(j);
        }
      }
    }
    return dupes;
  }, [data]);

  if (data.length < 2) return null;

  const minBw = Math.min(...data.map(d => d.bandwidth));
  const maxBw = Math.max(...data.map(d => d.bandwidth));
  const heights = [...new Set(data.map(d => d.height))].sort((a, b) => a - b);

  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  // Log scale for x-axis (bitrate)
  const logMin = Math.log10(minBw * 0.8);
  const logMax = Math.log10(maxBw * 1.2);
  const xScale = (bw: number) => PADDING.left + ((Math.log10(bw) - logMin) / (logMax - logMin)) * innerW;

  // Linear scale for y-axis (resolution height)
  const maxH = Math.max(...heights, 1);
  const yScale = (h: number) => PADDING.top + innerH - (h / (maxH * 1.15)) * innerH;

  // X-axis ticks
  const xTicks = generateLogTicks(minBw, maxBw);

  // Unique codecs for legend
  const codecLegend = [...new Map(data.map(d => [d.codecName, d.color])).entries()];

  return (
    <div className="bitrate-ladder">
      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="bitrate-ladder__svg">
        {/* Grid lines */}
        {xTicks.map(tick => (
          <line
            key={`xg-${tick}`}
            x1={xScale(tick)} y1={PADDING.top}
            x2={xScale(tick)} y2={PADDING.top + innerH}
            stroke="rgba(148,163,184,0.1)"
          />
        ))}
        {heights.map(h => (
          <line
            key={`yg-${h}`}
            x1={PADDING.left} y1={yScale(h)}
            x2={PADDING.left + innerW} y2={yScale(h)}
            stroke="rgba(148,163,184,0.1)"
          />
        ))}

        {/* Gap warning lines */}
        {gaps.map((g, i) => (
          <line
            key={`gap-${i}`}
            x1={xScale(data[g.from].bandwidth)} y1={yScale(data[g.from].height)}
            x2={xScale(data[g.to].bandwidth)} y2={yScale(data[g.to].height)}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"
          />
        ))}

        {/* Data points */}
        {data.map((d, i) => {
          const cx = xScale(d.bandwidth);
          const cy = yScale(d.height);
          const isDupe = duplicates.has(i);
          return (
            <g key={i}>
              {isDupe && (
                <circle cx={cx} cy={cy} r={DOT_RADIUS + 3} fill="none" stroke="#f59e0b" strokeWidth="2" opacity="0.7" />
              )}
              <circle cx={cx} cy={cy} r={DOT_RADIUS} fill={d.color} opacity="0.9">
                <title>{`${d.label} @ ${d.bitrateLabel}\n${d.codecName}\n${d.variant.codecs ?? ''}`}</title>
              </circle>
              <text
                x={cx} y={cy - DOT_RADIUS - 4}
                textAnchor="middle" fontSize="9" fill="#94a3b8"
              >
                {d.label}
              </text>
            </g>
          );
        })}

        {/* X-axis */}
        <line
          x1={PADDING.left} y1={PADDING.top + innerH}
          x2={PADDING.left + innerW} y2={PADDING.top + innerH}
          stroke="rgba(148,163,184,0.3)"
        />
        {xTicks.map(tick => (
          <text
            key={`xt-${tick}`}
            x={xScale(tick)} y={CHART_HEIGHT - 8}
            textAnchor="middle" fontSize="9" fill="#64748b"
          >
            {formatBw(tick)}
          </text>
        ))}

        {/* Y-axis */}
        <line
          x1={PADDING.left} y1={PADDING.top}
          x2={PADDING.left} y2={PADDING.top + innerH}
          stroke="rgba(148,163,184,0.3)"
        />
        {heights.map(h => (
          <text
            key={`yt-${h}`}
            x={PADDING.left - 8} y={yScale(h) + 3}
            textAnchor="end" fontSize="9" fill="#64748b"
          >
            {h === 0 ? 'Audio' : `${h}p`}
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={PADDING.left + innerW / 2} y={CHART_HEIGHT - 0}
          textAnchor="middle" fontSize="10" fill="#64748b"
        >
          Bitrate
        </text>
      </svg>

      {/* Legend */}
      <div className="bitrate-ladder__legend">
        {codecLegend.map(([name, color]) => (
          <span key={name} className="bitrate-ladder__legend-item">
            <span className="bitrate-ladder__legend-dot" style={{ background: color }} />
            {name}
          </span>
        ))}
        {gaps.length > 0 && (
          <span className="bitrate-ladder__legend-item bitrate-ladder__legend-item--warn">
            <span className="bitrate-ladder__legend-line" />
            {gaps.length} large gap{gaps.length > 1 ? 's' : ''} (&gt;{GAP_THRESHOLD}x)
          </span>
        )}
        {duplicates.size > 0 && (
          <span className="bitrate-ladder__legend-item bitrate-ladder__legend-item--warn">
            <span className="bitrate-ladder__legend-ring" />
            {duplicates.size} near-duplicate{duplicates.size > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function formatBw(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)}M`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)}K`;
  return `${bps}`;
}

function generateLogTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  const bases = [1, 2, 5];
  let magnitude = Math.pow(10, Math.floor(Math.log10(min)));

  while (magnitude * 10 <= max * 2) {
    for (const b of bases) {
      const val = magnitude * b;
      if (val >= min * 0.8 && val <= max * 1.2) {
        ticks.push(val);
      }
    }
    magnitude *= 10;
  }

  return ticks.length > 0 ? ticks : [min, max];
}
