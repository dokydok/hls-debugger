import { useState, type FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function UrlForm({ onSubmit, loading }: Props) {
  const [value, setValue] = useState('');

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
    </form>
  );
}
