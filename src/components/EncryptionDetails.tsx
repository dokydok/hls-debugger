import type { EncryptionInfo } from '../lib/types';

interface Props {
  encryption: EncryptionInfo;
}

export function EncryptionDetails({ encryption }: Props) {
  if (!encryption.isEncrypted) return null;

  return (
    <div>
      <div className="summary-grid">
        <Item label="Method" value={encryption.method || 'Unknown'} tooltip="EXT-X-KEY METHOD; encryption algorithm (AES-128, SAMPLE-AES, etc.)" />
        {encryption.keyUri && (
          <div className="summary-item">
            <span className="summary-item__label" title="URL where the decryption key can be fetched">Key URI</span>
            <span className="summary-item__value truncate" title={encryption.keyUri}>
              {encryption.keyUri}
            </span>
          </div>
        )}
        <Item label="Key Rotations" value={String(encryption.keyRotationCount)} tooltip="Number of distinct encryption keys used; more than 1 means key rotation" />
      </div>

      {encryption.uniqueKeys.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Unique Keys</p>
          <div className="track-list">
            {encryption.uniqueKeys.map((key, i) => (
              <div key={i} className="track-item track-item--info">
                <div>
                  <span className="track-item__name">{key.method}</span>
                  {key.uri && <span className="track-item__meta truncate"> · {key.uri}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {encryption.contentProtection && (
        <div style={{ marginTop: 12 }}>
          <p className="group-label">Content Protection / DRM</p>
          <div className="raw-manifest">
            <pre>{JSON.stringify(encryption.contentProtection, null, 2)}</pre>
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
