import { useState } from 'react';

export interface DiffEntry {
  timestamp: number;
  added: string[];
  removed: string[];
  unchanged: number;
}

interface Props {
  history: DiffEntry[];
}

export function ManifestDiff({ history }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0);

  if (history.length === 0) {
    return <p className="text-dim">Waiting for manifest updates…</p>;
  }

  const entry = history[selectedIdx] ?? history[0];
  const hasChanges = entry.added.length > 0 || entry.removed.length > 0;

  return (
    <div className="manifest-diff">
      <div className="manifest-diff__controls">
        <select
          className="manifest-diff__select"
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
        >
          {history.map((h, i) => (
            <option key={i} value={i}>
              {formatTime(h.timestamp)}
              {' — '}
              +{h.added.length} / −{h.removed.length}
            </option>
          ))}
        </select>
        <span className="manifest-diff__stats">
          {history.length} update{history.length !== 1 ? 's' : ''}
        </span>
      </div>

      {!hasChanges && (
        <p className="text-dim" style={{ margin: '8px 0 0' }}>No changes in this poll.</p>
      )}

      {hasChanges && (
        <div className="manifest-diff__content">
          {entry.removed.map((line, i) => (
            <div key={`r-${i}`} className="manifest-diff__line manifest-diff__line--removed">
              <span className="manifest-diff__marker">−</span>
              {line}
            </div>
          ))}
          {entry.added.map((line, i) => (
            <div key={`a-${i}`} className="manifest-diff__line manifest-diff__line--added">
              <span className="manifest-diff__marker">+</span>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Compute a line-based diff between two manifest texts.
 */
export function computeDiff(prev: string, curr: string): DiffEntry {
  const prevLines = new Set(prev.split('\n'));
  const currLines = curr.split('\n');
  const currSet = new Set(currLines);

  const added: string[] = [];
  const removed: string[] = [];

  for (const line of currLines) {
    if (!prevLines.has(line) && line.trim().length > 0) {
      added.push(line);
    }
  }

  for (const line of prevLines) {
    if (!currSet.has(line) && line.trim().length > 0) {
      removed.push(line);
    }
  }

  const unchanged = currLines.filter(l => prevLines.has(l)).length;

  return { timestamp: Date.now(), added, removed, unchanged };
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}
