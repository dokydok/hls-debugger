import { useState, useCallback } from 'react';
import type { Variant, MediaTrackGroup } from '../lib/types';

interface Entry {
  label: string;
  uri: string;
}

interface Props {
  variants: Variant[];
  audioGroups: MediaTrackGroup[];
  subtitleGroups: MediaTrackGroup[];
  cache: Record<string, string>;
}

export function SubManifests({ variants, audioGroups, subtitleGroups, cache }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

  const toggle = useCallback((uri: string) => {
    setExpanded(prev => ({ ...prev, [uri]: !prev[uri] }));
  }, []);

  if (entries.length === 0) {
    return <p className="text-dim">No sub-manifests found.</p>;
  }

  return (
    <div className="sub-manifests">
      {entries.map((entry) => {
        const text = cache[entry.uri];
        const isOpen = expanded[entry.uri];
        return (
          <div key={entry.uri} className="sub-manifest-entry">
            <div className="sub-manifest-entry__header">
              <div className="sub-manifest-entry__info">
                <span className="sub-manifest-entry__label">{entry.label}</span>
                <span className="sub-manifest-entry__url-row">
                  <span className="sub-manifest-entry__uri truncate" title={entry.uri}>
                    {entry.uri}
                  </span>
                  <button
                    className="icon-btn icon-btn--sm"
                    onClick={() => navigator.clipboard.writeText(entry.uri)}
                    title="Copy URL"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </span>
              </div>
              {text ? (
                <button className="btn btn--ghost" onClick={() => toggle(entry.uri)}>
                  {isOpen ? 'Hide' : 'Show'}
                </button>
              ) : (
                <span className="text-dim" style={{ fontSize: '0.8rem' }}>Loading…</span>
              )}
            </div>
            {isOpen && text && (
              <div className="raw-manifest" style={{ marginTop: 8 }}>
                <pre>{text}</pre>
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
