import type { LowLatencyInfo } from '../lib/types';

interface Props {
  info: LowLatencyInfo;
}

export function LowLatencyPanel({ info }: Props) {
  if (!info.hasLowLatency) return null;

  return (
    <div>
      <div className="summary-grid">
        {info.partTargetDuration != null && (
          <Item label="Part Target" value={`${info.partTargetDuration}s`} />
        )}
        {info.totalPartsCount > 0 && (
          <Item label="Total Parts" value={String(info.totalPartsCount)} />
        )}
      </div>

      {info.serverControl && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Server Control</p>
          <div className="summary-grid">
            {info.serverControl.canBlockReload != null && (
              <Item label="Block Reload" value={info.serverControl.canBlockReload ? 'Yes' : 'No'} />
            )}
            {info.serverControl.holdBack != null && (
              <Item label="Hold Back" value={`${info.serverControl.holdBack}s`} />
            )}
            {info.serverControl.partHoldBack != null && (
              <Item label="Part Hold Back" value={`${info.serverControl.partHoldBack}s`} />
            )}
            {info.serverControl.canSkipUntil != null && (
              <Item label="Can Skip Until" value={`${info.serverControl.canSkipUntil}s`} />
            )}
            {info.serverControl.canSkipDateranges != null && (
              <Item label="Skip Dateranges" value={info.serverControl.canSkipDateranges ? 'Yes' : 'No'} />
            )}
          </div>
        </div>
      )}

      {info.preloadHints.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Preload Hints ({info.preloadHints.length})</p>
          <div className="track-list">
            {info.preloadHints.map((hint, i) => (
              <div key={i} className="track-item track-item--info">
                <span className="track-item__name">{hint.type}</span>
                <span className="track-item__meta truncate">{hint.uri}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {info.renditionReports.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Rendition Reports ({info.renditionReports.length})</p>
          <div className="track-list">
            {info.renditionReports.map((r, i) => (
              <div key={i} className="track-item track-item--info">
                <span className="track-item__name truncate">{r.uri}</span>
                <span className="track-item__meta">
                  MSN: {r.lastMsn ?? '—'}
                  {r.lastPart != null && ` · Part: ${r.lastPart}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {info.skip && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Skip</p>
          <div className="summary-grid">
            {info.skip.skippedSegments != null && (
              <Item label="Skipped Segments" value={String(info.skip.skippedSegments)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label">{label}</span>
      <span className="summary-item__value">{value}</span>
    </div>
  );
}
