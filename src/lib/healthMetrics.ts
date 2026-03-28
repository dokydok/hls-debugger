export interface MetricSample {
  time: number;
  value: number;
}

export type MetricStatus = 'healthy' | 'warning' | 'critical';

export interface HealthMetric {
  name: string;
  unit: string;
  current: number;
  samples: MetricSample[];
  status: MetricStatus;
}

export interface StreamHealth {
  pollLatency: HealthMetric;
  downloadSpeed: HealthMetric;
  staleness: HealthMetric;
  bufferHealth: HealthMetric;
  overallStatus: MetricStatus;
}

interface Thresholds {
  warningAbove?: number;
  criticalAbove?: number;
  warningBelow?: number;
  criticalBelow?: number;
}

const MAX_SAMPLES = 60;

export function createMetric(name: string, unit: string): HealthMetric {
  return { name, unit, current: 0, samples: [], status: 'healthy' };
}

export function createStreamHealth(): StreamHealth {
  return {
    pollLatency: createMetric('Poll Latency', 'ms'),
    downloadSpeed: createMetric('Download Speed', 'Mbps'),
    staleness: createMetric('Staleness', 's'),
    bufferHealth: createMetric('Buffer', 's'),
    overallStatus: 'healthy',
  };
}

export function addSample(
  metric: HealthMetric,
  value: number,
  thresholds: Thresholds,
): HealthMetric {
  const samples = [...metric.samples, { time: Date.now(), value }];
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);

  let status: MetricStatus = 'healthy';
  if (thresholds.criticalAbove != null && value > thresholds.criticalAbove) {
    status = 'critical';
  } else if (thresholds.warningAbove != null && value > thresholds.warningAbove) {
    status = 'warning';
  } else if (thresholds.criticalBelow != null && value < thresholds.criticalBelow) {
    status = 'critical';
  } else if (thresholds.warningBelow != null && value < thresholds.warningBelow) {
    status = 'warning';
  }

  return { ...metric, current: value, samples, status };
}

export function computeOverallStatus(health: StreamHealth): MetricStatus {
  const statuses = [
    health.pollLatency.status,
    health.downloadSpeed.status,
    health.staleness.status,
    health.bufferHealth.status,
  ];
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'healthy';
}
