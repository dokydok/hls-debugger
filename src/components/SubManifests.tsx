import { useState, useCallback } from 'react';
import type { Variant, MediaTrackGroup } from '../lib/types';

interface Entry {
  label: string;
  uri: string;
}

interface FetchState {
  text: string;
  loading: boolean;
  error?: string;
}

interface Props {
  variants: Variant[];
  audioGroups: MediaTrackGroup[];
  subtitleGroups: MediaTrackGroup[];
}

export function SubManifests({ variants, audioGroups, subtitleGroups }: Props) {
  const [fetched, setFetched] = useState<Record<string, FetchState>>({});

  const entries: Entry[] = [];

  for (const v of variants) {
    const res = v.resolution
      ? `${v.resolution.width}×${v.resolution.height}`
      : 'Audio only';
    entries.push({ label: `${res} @ ${formatBandwidth(v.bandwidth)}`, uri: v.uri });
  }

  for (const g of audioGroups) {
    for (const t of g.tracks) {
      if (t.uri) entries.push({ label: `Audio: ${t.name} (${g.groupId})`, uri: t.uri });
    }
  }

  for (const g of subtitleGroups) {
    for (const t of g.tracks) {
      if (t.uri) entries.push({ label: `Subtitle: ${t.name} (${g.groupId})`, uri: t.uri });
    }
  }

  const handleFetch = useCallback(async (uri: string) => {
    setFetched(prev => ({ ...prev, [uri]: { text: '', loading: true } }));
    try {
      const res = await fetch(uri, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setFetched(prev => ({ ...prev, [uri]: { text, loading: false } }));
    } catch (err) {
      setFetched(prev => ({
        ...prev,
        [uri]: { text: '', loading: false, error: err instanceof Error ? err.message : 'Fetch failed' },
      }));
    }
  }, []);

  const handleHide = useCallback((uri: string) => {
    setFetched(prev => {
      const next = { ...prev };
      delete next[uri];
      return next;
    });
  }, []);

  if (entries.length === 0) {
    return <p className="text-dim">No sub-manifests found.</p>;
  }

  return (
    <div className="sub-manifests">
      {entries.map((entry) => {
        const state = fetched[entry.uri];
        return (
          <div key={entry.uri} className="sub-manifest-entry">
            <div className="sub-manifest-entry__header">
              <div className="sub-manifest-entry__info">
                <span className="sub-manifest-entry__label">{entry.label}</span>
                <span className="sub-manifest-entry__uri truncate" title={entry.uri}>
                  {fileName(entry.uri)}
                </span>
              </div>
              {!state?.text ? (
                <button
                  className="btn btn--ghost"
                  onClick={() => handleFetch(entry.uri)}
                  disabled={state?.loading}
                >
                  {state?.loading ? 'Loading…' : 'Fetch'}
                </button>
              ) : (
                <button className="btn btn--ghost" onClick={() => handleHide(entry.uri)}>
                  Hide
                </button>
              )}
            </div>
            {state?.error && (
              <div className="sub-manifest-entry__error">{state.error}</div>
            )}
            {state?.text && (
              <div className="raw-manifest" style={{ marginTop: 8 }}>
                <pre>{state.text}</pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatBandwidth(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} Kbps`;
  return `${bps} bps`;
}

function fileName(uri: string): string {
  try {
    return new URL(uri).pathname.split('/').pop() || uri;
  } catch {
    return uri.split('/').pop() || uri;
  }
}
