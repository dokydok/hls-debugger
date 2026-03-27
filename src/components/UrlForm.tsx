import { useState, useRef, type FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
  initialUrl?: string;
  onImport: (file: File) => void;
  onImportZip?: (file: File) => void;
}

export function UrlForm({ onSubmit, loading, initialUrl, onImport, onImportZip }: Props) {
  const [value, setValue] = useState(initialUrl ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        className="url-form__input"
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste HLS stream URL (.m3u8)"
        disabled={loading}
      />
      <button
        className="url-form__button"
        type="submit"
        disabled={loading || !value.trim()}
      >
        {loading ? 'Loading\u2026' : 'Load Stream'}
      </button>
      <button
        type="button"
        className="url-form__icon-btn"
        title="Import snapshot"
        onClick={() => fileRef.current?.click()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json,.zip,application/zip"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            if (file.name.endsWith('.zip') || file.type === 'application/zip') {
              onImportZip?.(file);
            } else {
              onImport(file);
            }
          }
          e.target.value = '';
        }}
      />
    </form>
  );
}
