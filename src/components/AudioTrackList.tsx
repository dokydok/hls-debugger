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

  if (hasRuntime) {
    const allManifestTracks = manifestGroups.flatMap((g) =>
      g.tracks.map((t) => ({ ...t, groupId: g.groupId })),
    );
    const merged = buildMergedTracks(allManifestTracks, runtimeTracks);

    return (
      <div>
        <div className="track-list">
          {merged.map((t) => {
            const isActive = t.runtimeId === currentTrack;
            return (
              <button
                key={t.key}
                className={`track-item ${isActive ? 'track-item--active' : ''}`}
                onClick={() => onSwitch(t.runtimeId!)}
              >
                <TrackInfo name={t.name} language={t.language} groupId={t.groupId} hasUri={t.hasAlternateUri} />
                <div className="track-item__badges">
                  {t.isDefault && <span className="badge badge--default">Default</span>}
                  {t.autoselect && !t.isDefault && <span className="badge badge--vod">Auto</span>}
                  {isActive && <span className="badge badge--default">Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {manifestGroups.map((group) => (
        <div key={group.groupId} style={{ marginTop: 8 }}>
          <p className="group-sublabel">Group: {group.groupId}</p>
          <div className="track-list">
            {group.tracks.map((t, i) => {
              const isActive = hasPlayer && currentTrack === i;
              if (hasPlayer) {
                return (
                  <button
                    key={i}
                    className={`track-item ${isActive ? 'track-item--active' : ''}`}
                    onClick={() => onSwitch(i)}
                  >
                    <TrackInfo name={t.name} language={t.language} groupId={group.groupId} hasUri={!!t.uri} />
                    <div className="track-item__badges">
                      {t.isDefault && <span className="badge badge--default">Default</span>}
                      {t.autoselect && !t.isDefault && <span className="badge badge--vod">Auto</span>}
                      {isActive && <span className="badge badge--default">Active</span>}
                    </div>
                  </button>
                );
              }
              return (
                <div key={i} className="track-item track-item--info">
                  <TrackInfo name={t.name} language={t.language} groupId={group.groupId} hasUri={!!t.uri} />
                  <div className="track-item__badges">
                    {t.isDefault && <span className="badge badge--default">Default</span>}
                    {t.autoselect && !t.isDefault && <span className="badge badge--vod">Auto</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrackInfo({ name, language, groupId, hasUri }: { name: string; language?: string; groupId?: string; hasUri?: boolean }) {
  return (
    <div>
      <span className="track-item__name">{name}</span>
      {language && <span className="track-item__meta"> &middot; {language}</span>}
      {groupId && <span className="track-item__meta"> &middot; {groupId}</span>}
      {hasUri && <span className="track-item__meta"> &middot; Alternate</span>}
    </div>
  );
}

interface MergedTrack {
  key: string;
  name: string;
  language?: string;
  groupId?: string;
  isDefault?: boolean;
  autoselect?: boolean;
  hasAlternateUri?: boolean;
  runtimeId: number;
}

function buildMergedTracks(
  manifestTracks: Array<{ name: string; language?: string; groupId: string; uri?: string; isDefault?: boolean; autoselect?: boolean }>,
  runtimeTracks: RuntimeTrack[],
): MergedTrack[] {
  const norm = (s?: string) => (s ?? '').toLowerCase().trim();
  const usedRuntime = new Set<number>();
  const result: MergedTrack[] = [];

  for (let i = 0; i < manifestTracks.length; i++) {
    const mt = manifestTracks[i];
    let rtId: number | null = null;
    for (const rt of runtimeTracks) {
      if (!usedRuntime.has(rt.id) && norm(rt.name) === norm(mt.name)) { rtId = rt.id; break; }
    }
    if (rtId == null && mt.language) {
      for (const rt of runtimeTracks) {
        if (!usedRuntime.has(rt.id) && norm(rt.language) === norm(mt.language)) { rtId = rt.id; break; }
      }
    }
    if (rtId == null) rtId = runtimeTracks.find((rt) => !usedRuntime.has(rt.id))?.id ?? 0;
    usedRuntime.add(rtId);

    result.push({
      key: `m-${i}`,
      name: mt.name,
      language: mt.language,
      groupId: mt.groupId,
      isDefault: mt.isDefault,
      autoselect: mt.autoselect,
      hasAlternateUri: !!mt.uri,
      runtimeId: rtId,
    });
  }

  for (const rt of runtimeTracks) {
    if (!usedRuntime.has(rt.id)) {
      result.push({ key: `rt-${rt.id}`, name: rt.name, language: rt.language, runtimeId: rt.id });
    }
  }

  return result;
}
