import { useEffect, useRef, useState } from 'react';
import 'stream-engine-player';
// @ts-expect-error — CSS import has no type declarations
import 'stream-engine-player/style';

interface Props {
  src: string;
}

declare global {
  interface Window {
    streamEnginePlayer: (id: string, options: Record<string, unknown>) => { dispose: () => void };
  }
}

let idCounter = 0;

export function StreamEnginePlayerPanel({ src }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const activeSrcRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !src) return;
    // Already initialized for this src
    if (activeSrcRef.current === src) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    // Nuke old player DOM (no dispose — avoids trackLive bug)
    wrapper.innerHTML = '';
    activeSrcRef.current = null;

    const id = `se-player-${++idCounter}`;
    const container = document.createElement('div');
    container.id = id;
    container.style.width = '100%';
    container.style.height = '100%';
    wrapper.appendChild(container);

    const timer = setTimeout(() => {
      // Verify container is still in the DOM
      if (!document.getElementById(id)) return;
      try {
        window.streamEnginePlayer(id, {
          src,
          controls: true,
          autoplay: false,
        });
        activeSrcRef.current = src;
      } catch {
        // ignore
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [open, src]);

  return (
    <div className="panel">
      <div className="panel__header" onClick={() => setOpen(!open)}>
        <span className="panel__title">Stream Engine Player</span>
        <span className={`panel__toggle ${open ? 'panel__toggle--open' : ''}`}>
          ▾
        </span>
      </div>
      <div
        className="panel__body"
        style={{ display: open ? 'block' : 'none' }}
      >
        <div
          ref={wrapperRef}
          className="stream-engine-player-wrapper"
        />
      </div>
    </div>
  );
}
