import { forwardRef, useState, useEffect, useCallback } from 'react';

interface Props {
  hasSource: boolean;
  offlineMessage?: string;
  isLive?: boolean;
}

const LIVE_THRESHOLD = 10;

export const VideoPanel = forwardRef<HTMLVideoElement, Props>(
  function VideoPanel({ hasSource, offlineMessage, isLive }, ref) {
    const [isAtLive, setIsAtLive] = useState(true);
    const [liveEdgeOffset, setLiveEdgeOffset] = useState(0);

    const getVideo = useCallback((): HTMLVideoElement | null => {
      if (!ref) return null;
      if (typeof ref === 'function') return null;
      return ref.current;
    }, [ref]);

    useEffect(() => {
      const video = getVideo();
      if (!video || !hasSource || !isLive) return;

      const update = () => {
        let end = 0;
        if (video.seekable.length > 0) {
          end = video.seekable.end(video.seekable.length - 1);
        } else if (isFinite(video.duration)) {
          end = video.duration;
        }
        const offset = end - video.currentTime;
        setLiveEdgeOffset(offset);
        setIsAtLive(offset < LIVE_THRESHOLD);
      };

      video.addEventListener('timeupdate', update);
      video.addEventListener('progress', update);
      update();

      return () => {
        video.removeEventListener('timeupdate', update);
        video.removeEventListener('progress', update);
      };
    }, [getVideo, hasSource, isLive]);

    const jumpToLive = useCallback(() => {
      const video = getVideo();
      if (!video) return;
      if (video.seekable.length > 0) {
        video.currentTime = video.seekable.end(video.seekable.length - 1);
      } else if (isFinite(video.duration)) {
        video.currentTime = video.duration;
      }
      video.play().catch(() => {});
    }, [getVideo]);

    return (
      <div className="video-panel">
        <div className="video-panel__wrapper">
          <video
            ref={ref}
            controls
            autoPlay
            muted
            playsInline
            crossOrigin="anonymous"
            style={{ display: hasSource ? 'block' : 'none' }}
          />
          {hasSource && isLive && (
            <button
              className={`video-live-pill ${isAtLive ? 'video-live-pill--live' : 'video-live-pill--behind'}`}
              onClick={jumpToLive}
              title={isAtLive ? 'At live edge' : 'Jump to live'}
            >
              <span className="video-live-pill__dot" />
              {isAtLive ? 'LIVE' : `−${formatOffset(liveEdgeOffset)}`}
            </button>
          )}
        </div>
        {!hasSource && (
          <div className="video-panel__placeholder">
            {offlineMessage ?? 'Enter an HLS URL above to start debugging'}
          </div>
        )}
      </div>
    );
  },
);

function formatOffset(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m${sec}s` : `${m}m`;
}
