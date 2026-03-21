import type { MediaTrackGroup, RuntimeTrack } from '../lib/types';

interface Props {
  subtitleGroups: MediaTrackGroup[];
  closedCaptionGroups: MediaTrackGroup[];
  runtimeTracks: RuntimeTrack[];
  currentTrack: number;
  onSwitch: (index: number) => void;
  hasPlayer: boolean;
}

export function CaptionTrackList({
  subtitleGroups,
  closedCaptionGroups,
  runtimeTracks,
  currentTrack,
  onSwitch,
  hasPlayer,
}: Props) {
  const hasManifest = subtitleGroups.length > 0 || closedCaptionGroups.length > 0;
  const hasRuntime = runtimeTracks.length > 0;

  if (!hasManifest && !hasRuntime) {
    return (
      <p className="notice">No subtitle or closed caption tracks in this stream.</p>
    );
  }

  return (
    <div>
      {hasPlayer && hasRuntime && (
        <>
          <p className="group-label">Player Subtitle Tracks</p>
          <div className="track-list">
            <button
              className={`track-item ${currentTrack === -1 ? 'track-item--active' : ''}`}
              onClick={() => onSwitch(-1)}
            >
              <span className="track-item__name">Off</span>
              {currentTrack === -1 && (
                <span className="badge badge--default">Active</span>
              )}
            </button>
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
          {subtitleGroups.map((group) => (
            <div key={group.groupId} style={{ marginTop: 8 }}>
              <p className="group-label">
                Subtitles &mdash; Group: {group.groupId}
              </p>
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
                        <span className="track-item__meta"> &middot; WebVTT</span>
                      )}
                    </div>
                    <div className="track-item__badges">
                      {t.isDefault && (
                        <span className="badge badge--default">Default</span>
                      )}
                      {t.forced && (
                        <span className="badge badge--event">Forced</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {closedCaptionGroups.map((group) => (
            <div key={group.groupId} style={{ marginTop: 8 }}>
              <p className="group-label">
                Closed Captions &mdash; Group: {group.groupId}
              </p>
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
                      {t.instreamId && (
                        <span className="track-item__meta">
                          {' '}
                          &middot; {t.instreamId}
                        </span>
                      )}
                    </div>
                    <div className="track-item__badges">
                      {t.isDefault && (
                        <span className="badge badge--default">Default</span>
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
