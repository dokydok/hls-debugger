import type { StreamHealth, HealthMetric, MetricStatus } from '../lib/healthMetrics';

interface Props {
  health: StreamHealth;
}

const STATUS_COLORS: Record<MetricStatus, string> = {
  healthy: '#4ade80',
  warning: '#fbbf24',
  critical: '#ef4444',
};

const TOOLTIPS: Record<string, string> = {
  'Poll Latency': 'Time to fetch the manifest on each poll. Yellow >500ms, Red >2s.',
  'Download Speed': 'Per-fragment download throughput. Yellow <1 Mbps, Red <500 Kbps.',
  'Staleness': 'Time since a new segment appeared in the manifest. Yellow >2× target duration, Red >4×.',
  'Buffer': 'Seconds of video buffered ahead of the current playback position. Yellow <3s, Red <1s.',
};

export function StreamHealthMonitor({ health }: Props) {
  return (
    <div className="health-monitor">
      <MetricRow metric={health.pollLatency} format={v => `${Math.round(v)}`} tooltip={TOOLTIPS['Poll Latency']} />
      <MetricRow metric={health.downloadSpeed} format={v => v >= 1 ? `${v.toFixed(1)}` : `${(v * 1000).toFixed(0)} K`} tooltip={TOOLTIPS['Download Speed']} />
      <MetricRow metric={health.staleness} format={v => `${v.toFixed(1)}`} tooltip={TOOLTIPS['Staleness']} />
      <MetricRow metric={health.bufferHealth} format={v => `${v.toFixed(1)}`} tooltip={TOOLTIPS['Buffer']} />
      <div className="health-monitor__overall">
        <span
          className="health-dot"
          style={{ background: STATUS_COLORS[health.overallStatus] }}
        />
        <span className="health-monitor__overall-label">
          {health.overallStatus === 'healthy' ? 'Healthy' :
           health.overallStatus === 'warning' ? 'Degraded' : 'Critical'}
        </span>
      </div>
    </div>
  );
}

function MetricRow({ metric, format, tooltip }: { metric: HealthMetric; format: (v: number) => string; tooltip?: string }) {
  const color = STATUS_COLORS[metric.status];

  return (
    <div className="health-metric" title={tooltip}>
      <span className="health-dot" style={{ background: color }} />
      <span className="health-metric__name">{metric.name}</span>
      <span className="health-metric__value">
        {metric.samples.length > 0 ? format(metric.current) : '—'}
        <span className="health-metric__unit">{metric.unit}</span>
      </span>
      <Sparkline samples={metric.samples} color={color} />
    </div>
  );
}

function Sparkline({ samples, color }: { samples: { value: number }[]; color: string }) {
  if (samples.length < 2) {
    return <div className="health-sparkline" />;
  }

  const values = samples.map(s => s.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const w = 120;
  const h = 24;
  const padding = 2;
  const innerH = h - padding * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = padding + innerH - ((v - min) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="health-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
