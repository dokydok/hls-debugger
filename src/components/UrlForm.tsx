import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

type FakeLiveMode = 'rolling' | 'event' | 'daily';

interface Props {
  value: string;
  onChange: (url: string) => void;
  onSubmit: (url: string) => void;
  loading: boolean;
  onImport: (file: File) => void;
  onImportZip?: (file: File) => void;
}

export function UrlForm({ value, onChange, onSubmit, loading, onImport, onImportZip }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const fakeLiveBtnRef = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<FakeLiveMode>('rolling');
  const [fakeLiveOpen, setFakeLiveOpen] = useState(false);
  const [popPos, setPopPos] = useState<{ top: number; right: number } | null>(null);
  const [srcUrls, setSrcUrls] = useState<string[]>(['']);

  useEffect(() => {
    if (!fakeLiveOpen) return;
    function reposition() {
      const r = fakeLiveBtnRef.current?.getBoundingClientRect();
      if (r) setPopPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    reposition();
    function onDocClick(e: MouseEvent) {
      const tgt = e.target as Node;
      if (popoverRef.current?.contains(tgt)) return;
      if (fakeLiveBtnRef.current?.contains(tgt)) return;
      setFakeLiveOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [fakeLiveOpen]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  }

  const isAlreadyFakeLive = /\/api\/fake-live\//.test(value);

  function openFakeLivePopover() {
    setSrcUrls([value.trim() || '']);
    setFakeLiveOpen((o) => !o);
  }

  function handleMakeFakeLive(selectedMode: FakeLiveMode) {
    const validSrcs = srcUrls.map((s) => s.trim()).filter(Boolean);
    if (validSrcs.length === 0) return;
    const params = new URLSearchParams();
    for (const s of validSrcs) params.append('src', s);
    params.set('mode', selectedMode);
    const fakeUrl = `${window.location.origin}/api/fake-live/master.m3u8?${params.toString()}`;
    onChange(fakeUrl);
    setFakeLiveOpen(false);
  }

  function handleUnwrap() {
    try {
      const u = new URL(value);
      const src = u.searchParams.get('src');
      if (src) onChange(src);
    } catch { /* ignore */ }
  }

  return (
    <form className="url-form" onSubmit={handleSubmit}>
      <input
        className="url-form__input"
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste HLS stream URL (.m3u8)"
        disabled={loading}
      />
      <button
        className="url-form__button"
        type="submit"
        disabled={loading || !value.trim()}
      >
        {loading ? 'Loading…' : 'Load Stream'}
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
      <div className="url-form__fake-live">
        {isAlreadyFakeLive ? (
          <button
            type="button"
            className="url-form__icon-btn"
            title="Restore original URL (unwrap fake-live)"
            onClick={handleUnwrap}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
        ) : (
          <button
            ref={fakeLiveBtnRef}
            type="button"
            className="url-form__icon-btn"
            title="Wrap this URL as a fake live stream"
            onClick={openFakeLivePopover}
            disabled={loading}
            aria-expanded={fakeLiveOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12a10 10 0 0 1 20 0" />
              <path d="M5.5 12a6.5 6.5 0 0 1 13 0" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          </button>
        )}
        {fakeLiveOpen && popPos && createPortal(
          <div
            ref={popoverRef}
            className="url-form__fake-live-pop"
            style={{ top: popPos.top, right: popPos.right }}
          >
            <div className="url-form__fake-live-title">Sources</div>
            {srcUrls.map((src, i) => (
              <div key={i} className="url-form__fake-live-src-row">
                <input
                  type="text"
                  className="url-form__fake-live-src-input"
                  value={src}
                  onChange={(e) => setSrcUrls((prev) => prev.map((s, idx) => idx === i ? e.target.value : s))}
                  placeholder="https://cdn.example.com/vod/master.m3u8"
                />
                {srcUrls.length > 1 && (
                  <button
                    type="button"
                    className="url-form__fake-live-src-remove"
                    onClick={() => setSrcUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    title="Remove source"
                  >×</button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="url-form__fake-live-add-src"
              onClick={() => setSrcUrls((prev) => [...prev, ''])}
            >+ Add source</button>
            <div className="url-form__fake-live-title" style={{ marginTop: 6 }}>Mode</div>
            <label className="url-form__fake-live-row">
              <input type="radio" name="fake-live-mode" value="rolling" checked={mode === 'rolling'} onChange={() => setMode('rolling')} />
              <span>Rolling (4-chunk window)</span>
            </label>
            <label className="url-form__fake-live-row">
              <input type="radio" name="fake-live-mode" value="event" checked={mode === 'event'} onChange={() => setMode('event')} />
              <span>Event (grows then resets)</span>
            </label>
            <label className="url-form__fake-live-row">
              <input type="radio" name="fake-live-mode" value="daily" checked={mode === 'daily'} onChange={() => setMode('daily')} />
              <span>Daily (loops chunks, resets at midnight UTC)</span>
            </label>
            <button
              type="button"
              className="url-form__fake-live-apply"
              disabled={srcUrls.some((s) => !s.trim())}
              onClick={() => handleMakeFakeLive(mode)}
            >
              Apply
            </button>
          </div>,
          document.body,
        )}
      </div>
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
