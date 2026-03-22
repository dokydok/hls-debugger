import { forwardRef } from 'react';

interface Props {
  hasSource: boolean;
  offlineMessage?: string;
}

export const VideoPanel = forwardRef<HTMLVideoElement, Props>(
  function VideoPanel({ hasSource, offlineMessage }, ref) {
    return (
      <div className="video-panel">
        <video
          ref={ref}
          controls
          playsInline
          crossOrigin="anonymous"
          style={{ display: hasSource ? 'block' : 'none' }}
        />
        {!hasSource && (
          <div className="video-panel__placeholder">
            {offlineMessage ?? 'Enter an HLS URL above to start debugging'}
          </div>
        )}
      </div>
    );
  },
);
