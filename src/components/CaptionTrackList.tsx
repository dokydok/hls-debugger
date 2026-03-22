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
    return <p className="notice">No subtitle or closed caption tracks in this stream.</p>;
  }

  const allManifestTracks = [
    ...subtitleGroups.flatMap((g) =>
      g.tracks.map((t) => ({ ...t, groupId: g.groupId, kind: 'subtitle' as const })),
    ),
    ...closedCaptionGroups.flatMap((g) =>
      g.tracks.map((t) => ({ ...t, groupId: g.groupId, kind: 'cc' as const })),
    ),
  ];

  if (hasRuntime) {
    const merged = buildMergedTracks(allManifestTracks, runtimeTracks);
    return (
      <div>
        <div className="track-list">
          <button
            className={`track-item ${currentTrack === -1 ? 'track-item--active' : ''}`}
            onClick={() => onSwitch(-1)}
          >
            <span className="track-item__name">Off</span>
            {currentTrack === -1 && <span className="badge badge--default">Active</span>}
          </button>
          {merged.map((t) => {
            const isActive = t.runtimeId === currentTrack;
            return (
              <button
                key={t.key}
                className={`track-item ${isActive ? 'track-item--active' : ''}`}
                onClick={() => onSwitch(t.runtimeId)}
              >
                <TrackInfo name={t.name} language={t.language} groupId={t.groupId} kind={t.kind} instreamId={t.instreamId} />
                <div className="track-item__badges">
                  {t.isDefault && <span className="badge badge--default">Default</span>}
                  {t.forced && <span className="badge badge--event">Forced</span>}
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
      <div className="track-list">
        {hasPlayer && (
          <button
            className={`track-item ${currentTrack === -1 ? 'track-item--active' : ''}`}
            onClick={() => onSwitch(-1)}
          >
            <span className="track-item__name">Off</span>
            {currentTrack === -1 && <span className="badge badge--default">Active</span>}
          </button>
        )}
        {allManifestTracks.map((t, i) => {
          const isActive = hasPlayer && currentTrack === i;
          if (hasPlayer) {
            return (
              <button
                key={i}
                className={`track-item ${isActive ? 'track-item--active' : ''}`}
                onClick={() => onSwitch(i)}
              >
                <TrackInfo name={t.name} language={t.language} groupId={t.groupId} kind={t.kind} instreamId={t.instreamId} />
                <div className="track-item__badges">
                  {t.isDefault && <span className="badge badge--default">Default</span>}
                  {t.forced && <span className="badge badge--event">Forced</span>}
                  {isActive && <span className="badge badge--default">Active</span>}
                </div>
              </button>
            );
          }
          return (
            <div key={i} className="track-item track-item--info">
              <TrackInfo name={t.name} language={t.language} groupId={t.groupId} kind={t.kind} instreamId={t.instreamId} />
              <div className="track-item__badges">
                {t.isDefault && <span className="badge badge--default">Default</span>}
                {t.forced && <span className="badge badge--event">Forced</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrackInfo({ name, language, groupId, kind, instreamId }: {
  name: string; language?: string; groupId?: string; kind?: 'subtitle' | 'cc'; instreamId?: string;
}) {
  return (
    <div>
      <span className="track-item__name">{name}</span>
      {language && <span className="track-item__meta"> &middot; {language}</span>}
      {groupId && <span className="track-item__meta"> &middot; {groupId}</span>}
      {instreamId && <span className="track-item__meta"> &middot; {instreamId}</span>}
      {kind === 'cc' && !instreamId && <span className="track-item__meta"> &middot; CC</span>}
    </div>
  );
}

interface MergedTrack {
  key: string;
  name: string;
  language?: string;
  groupId?: string;
  kind?: 'subtitle' | 'cc';
  isDefault?: boolean;
  forced?: boolean;
  instreamId?: string;
  runtimeId: number;
}

function buildMergedTracks(
  manifestTracks: Array<{
    name: string; language?: string; groupId: string; kind: 'subtitle' | 'cc';
    isDefault?: boolean; forced?: boolean; instreamId?: string;
  }>,
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
      key: `m-${i}`, name: mt.name, language: mt.language, groupId: mt.groupId,
      kind: mt.kind, isDefault: mt.isDefault, forced: mt.forced, instreamId: mt.instreamId,
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
