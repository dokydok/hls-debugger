import type { MediaTrackGroup, RuntimeTrack } from '../lib/types';

interface Props {
  manifestGroups: MediaTrackGroup[];
  runtimeTracks: RuntimeTrack[];
  currentTrack: number;
  onSwitch: (index: number) => void;
  hasPlayer: boolean;
}

export function AudioTrackList({
  manifestGroups,
  runtimeTracks,
  currentTrack,
  onSwitch,
  hasPlayer,
}: Props) {
  const hasManifest = manifestGroups.length > 0;
  const hasRuntime = runtimeTracks.length > 0;

  if (!hasManifest && !hasRuntime) {
    return <p className="notice">No alternate audio tracks in this stream.</p>;
  }

  return (
    <div>
      {hasPlayer && hasRuntime && (
        <>
          <p className="group-label">Player Audio Tracks</p>
          <div className="track-list">
            {runtimeTracks.map((t) => (
              <button
                key={t.id}
                className={`track-item ${currentTrack === t.id ? 'track-item--active' : ''}`}
                onClick={() => onSwitch(t.id)}
              >
                <div>
                  <span className="track-item__name">{t.name}</span>
                  {t.language && (
                    <span className="track-item__meta"> &middot; {t.language}</span>
                  )}
                </div>
                {currentTrack === t.id && (
                  <span className="badge badge--default">Active</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {hasManifest && (
        <div style={{ marginTop: hasPlayer && hasRuntime ? 16 : 0 }}>
          <p className="group-label">Manifest Audio Groups</p>
          {manifestGroups.map((group) => (
            <div key={group.groupId} style={{ marginTop: 8 }}>
              <p className="group-sublabel">Group: {group.groupId}</p>
              <div className="track-list">
                {group.tracks.map((t, i) => (
                  <div key={i} className="track-item track-item--info">
                    <div>
                      <span className="track-item__name">{t.name}</span>
                      {t.language && (
                        <span className="track-item__meta">
                          {' '}
                          &middot; {t.language}
                        </span>
                      )}
                      {t.uri && (
                        <span className="track-item__meta"> &middot; Alternate</span>
                      )}
                    </div>
                    <div className="track-item__badges">
                      {t.isDefault && (
                        <span className="badge badge--default">Default</span>
                      )}
                      {t.autoselect && !t.isDefault && (
                        <span className="badge badge--vod">Auto</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
