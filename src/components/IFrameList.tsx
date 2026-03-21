import type { IFramePlaylistInfo } from '../lib/types';

interface Props {
  playlists: IFramePlaylistInfo[];
}

export function IFrameList({ playlists }: Props) {
  if (playlists.length === 0) return null;

  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Resolution</th>
            <th>Bandwidth</th>
            <th>Codecs</th>
            <th>URI</th>
          </tr>
        </thead>
        <tbody>
          {playlists.map((p, i) => (
            <tr key={i}>
              <td>{p.resolution ? `${p.resolution.width}×${p.resolution.height}` : '—'}</td>
              <td>{formatBandwidth(p.bandwidth)}</td>
              <td>{p.codecs || '—'}</td>
              <td className="truncate" title={p.uri}>{fileName(p.uri)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
