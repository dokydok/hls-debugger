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
          <Item label="Part Target" value={`${info.partTargetDuration}s`} tooltip="EXT-X-PART-INF; target duration for partial segments" />
        )}
        {info.totalPartsCount > 0 && (
          <Item label="Total Parts" value={String(info.totalPartsCount)} tooltip="Total number of EXT-X-PART partial segments across all segments" />
        )}
      </div>

      {info.serverControl && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Server Control</p>
          <div className="summary-grid">
            {info.serverControl.canBlockReload != null && (
              <Item label="Block Reload" value={info.serverControl.canBlockReload ? 'Yes' : 'No'} tooltip="CAN-BLOCK-RELOAD; server supports blocking playlist reload requests" />
            )}
            {info.serverControl.holdBack != null && (
              <Item label="Hold Back" value={`${info.serverControl.holdBack}s`} tooltip="HOLD-BACK; how far from the live edge the player should stay" />
            )}
            {info.serverControl.partHoldBack != null && (
              <Item label="Part Hold Back" value={`${info.serverControl.partHoldBack}s`} tooltip="PART-HOLD-BACK; how far from the live edge for partial segment playback" />
            )}
            {info.serverControl.canSkipUntil != null && (
              <Item label="Can Skip Until" value={`${info.serverControl.canSkipUntil}s`} tooltip="CAN-SKIP-UNTIL; server can omit segments older than this from playlist updates" />
            )}
            {info.serverControl.canSkipDateranges != null && (
              <Item label="Skip Dateranges" value={info.serverControl.canSkipDateranges ? 'Yes' : 'No'} tooltip="CAN-SKIP-DATERANGES; server can omit date range tags in skipped sections" />
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
              <Item label="Skipped Segments" value={String(info.skip.skippedSegments)} tooltip="SKIPPED-SEGMENTS; number of segments omitted via delta playlist update" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Item({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label" title={tooltip}>{label}</span>
      <span className="summary-item__value">{value}</span>
    </div>
  );
}
