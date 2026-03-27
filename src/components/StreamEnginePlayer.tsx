import { useEffect, useState, useRef } from 'react';
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

function generateId() {
  return 'se-' + Math.random().toString(36).slice(2, 10);
}

export function StreamEnginePlayer({ src }: Props) {
  const [playerKey, setPlayerKey] = useState(() => generateId());

  useEffect(() => {
    setPlayerKey(generateId());
  }, [src]);

  return <PlayerInstance key={playerKey} id={playerKey} src={src} />;
}

function PlayerInstance({ id, src }: { id: string; src: string }) {
  const playerRef = useRef<{ dispose: () => void } | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Defer init to next tick so React strict mode's
    // unmount+remount cycle settles before we create the player
    const timer = setTimeout(() => {
      if (!mountedRef.current || !src) return;
      const el = document.getElementById(id);
      if (!el) return;

      try {
        playerRef.current = window.streamEnginePlayer(id, {
          src,
          controls: true,
          autoplay: false,
        });
      } catch {
        // ignore init errors
      }
    }, 50);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      // Defer dispose to let the DOM settle
      const player = playerRef.current;
      if (player) {
        playerRef.current = null;
        setTimeout(() => {
          try { player.dispose(); } catch { /* ignore */ }
        }, 0);
      }
    };
  }, [id, src]);

  return (
    <div
      id={id}
      className="stream-engine-player-wrapper"
    />
  );
}
