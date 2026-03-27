import { useState, useRef, useCallback, useEffect } from 'react';
import type { ParsedManifest } from '../lib/types';
import { RecordingEngine } from '../lib/recorder';
import type { RecordingStats, RecordingState } from '../lib/recorder';

interface Props {
  manifest: ParsedManifest;
  masterUrl: string;
  needsPolling: boolean;
  getPlaybackTime?: () => number;
}

export function RecordingControls({ manifest, masterUrl, needsPolling, getPlaybackTime }: Props) {
  const engineRef = useRef<RecordingEngine | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const [state, setState] = useState<RecordingState>('idle');
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const handleUpdate = useCallback((s: RecordingStats) => {
    setStats(s);
    setState(s.state);
  }, []);

  // Elapsed time ticker
  useEffect(() => {
    if (state === 'recording') {
      elapsedRef.current = setInterval(() => {
        const s = engineRef.current?.getStats();
        if (s) setStats(s);
      }, 1000);
    } else {
      clearInterval(elapsedRef.current);
    }
    return () => clearInterval(elapsedRef.current);
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  const handleRecord = useCallback(() => {
    recordStartTimeRef.current = getPlaybackTime?.() ?? 0;
    const engine = new RecordingEngine(handleUpdate);
    engineRef.current = engine;
    engine.start(masterUrl, manifest.raw, manifest, needsPolling);
    setState('recording');
  }, [masterUrl, manifest, needsPolling, handleUpdate, getPlaybackTime]);

  const handleStop = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    const stopTime = getPlaybackTime?.() ?? 0;
    try {
      const blob = await engine.stop(recordStartTimeRef.current, stopTime);
      downloadBlob(blob);
    } catch (err) {
      console.error('Recording export failed:', err);
    } finally {
      engineRef.current = null;
    }
  }, [getPlaybackTime]);

  if (state === 'idle') {
    return (
      <button
        className="icon-btn recording-btn recording-btn--record"
        onClick={handleRecord}
        title="Record stream"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="8" />
        </svg>
      </button>
    );
  }

  if (state === 'stopping' || state === 'processing') {
    return (
      <div className="recording-controls">
        <span className="spinner" />
        <span className="recording-stats">
          {state === 'stopping' ? 'Stopping…' : 'Packaging ZIP…'}
        </span>
      </div>
    );
  }

  // Recording state
  return (
    <div className="recording-controls">
      <span className="recording-dot" />
      <span className="recording-stats">
        {formatElapsed(stats?.elapsed ?? 0)}
        {needsPolling && (
          <>
            {' · '}
            {stats?.segmentCount ?? 0} segs
            {' · '}
            {formatBytes(stats?.totalBytes ?? 0)}
          </>
        )}
      </span>
      <button
        className="icon-btn recording-btn recording-btn--stop"
        onClick={handleStop}
        title="Stop recording"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function downloadBlob(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `hls-recording-${ts}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
