import type { Variant } from '../lib/types';

interface Props {
  variants: Variant[];
  activeUrl: string | null;
  masterUrl: string;
  onPlayVariant: (url: string) => void;
  onPlayMaster: () => void;
}

function formatBandwidth(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${Math.round(bps / 1_000)} Kbps`;
  return `${bps} bps`;
}

export function RenditionList({
  variants,
  activeUrl,
  masterUrl,
  onPlayVariant,
  onPlayMaster,
}: Props) {
  if (variants.length === 0) {
    return <p className="notice">No variants found in this playlist.</p>;
  }

  const isMasterActive = activeUrl === masterUrl;

  return (
    <div className="rendition-list">
      <button
        className={`rendition-item ${isMasterActive ? 'rendition-item--active' : ''}`}
        onClick={onPlayMaster}
      >
        <div className="rendition-item__info">
          <span className="rendition-item__primary">Auto (ABR)</span>
          <span className="rendition-item__secondary">
            Adaptive bitrate &mdash; player selects best quality
          </span>
        </div>
        {isMasterActive && <span className="badge badge--live">Playing</span>}
      </button>

      {variants.map((v, i) => {
        const isActive = activeUrl === v.uri;
        const res = v.resolution
          ? `${v.resolution.width}\u00d7${v.resolution.height}`
          : 'Audio only';
        const details = [
          v.codecs,
          v.frameRate ? `${v.frameRate}fps` : null,
          v.averageBandwidth ? `avg: ${formatBandwidth(v.averageBandwidth)}` : null,
          v.audioGroup ? `audio: ${v.audioGroup}` : null,
          v.videoRange,
          v.hdcpLevel ? `HDCP: ${v.hdcpLevel}` : null,
          v.name ? `"${v.name}"` : null,
          v.programId != null ? `PID: ${v.programId}` : null,
        ]
          .filter(Boolean)
          .join(' \u00b7 ');

        return (
          <button
            key={i}
            className={`rendition-item ${isActive ? 'rendition-item--active' : ''}`}
            onClick={() => onPlayVariant(v.uri)}
          >
            <div className="rendition-item__info">
              <span className="rendition-item__primary">
                {res} &mdash; {formatBandwidth(v.bandwidth)}
              </span>
              {details && (
                <span className="rendition-item__secondary">{details}</span>
              )}
            </div>
            {isActive ? (
              <span className="badge badge--live">Playing</span>
            ) : (
              <span className="btn btn--ghost">Play</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
