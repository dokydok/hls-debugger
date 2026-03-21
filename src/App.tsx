import { useState, useRef, useCallback, useEffect } from 'react';
import Hls from 'hls.js';
import { UrlForm } from './components/UrlForm';
import { VideoPanel } from './components/VideoPanel';
import { RenditionList } from './components/RenditionList';
import { AudioTrackList } from './components/AudioTrackList';
import { CaptionTrackList } from './components/CaptionTrackList';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { ManifestIssues } from './components/ManifestIssues';
import { SegmentAnalysis } from './components/SegmentAnalysis';
import { SegmentList } from './components/SegmentList';
import { EncryptionDetails } from './components/EncryptionDetails';
import { DateRangeList } from './components/DateRangeList';
import { LowLatencyPanel } from './components/LowLatencyPanel';
import { IFrameList } from './components/IFrameList';
import { SubManifests } from './components/SubManifests';
import { parseManifest } from './lib/parseManifest';
import { validateManifest } from './lib/validateManifest';
import type { ParsedManifest, RuntimeTrack } from './lib/types';

function App() {
  const [manifest, setManifest] = useState<ParsedManifest | null>(null);
  const [masterUrl, setMasterUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hlsAudioTracks, setHlsAudioTracks] = useState<RuntimeTrack[]>([]);
  const [hlsSubtitleTracks, setHlsSubtitleTracks] = useState<RuntimeTrack[]>([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(-1);
  const [currentSubtitleTrack, setCurrentSubtitleTrack] = useState(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const isNativeRef = useRef(false);

  const destroyPlayer = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setHlsAudioTracks([]);
    setHlsSubtitleTracks([]);
    setCurrentAudioTrack(-1);
    setCurrentSubtitleTrack(-1);
    isNativeRef.current = false;
  }, []);

  useEffect(() => {
    if (!activeUrl) return;
    const video = videoRef.current;
    if (!video) return;

    destroyPlayer();

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      isNativeRef.current = false;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setHlsAudioTracks(
          hls.audioTracks.map((t, i) => ({
            id: i,
            name: t.name || `Track ${i + 1}`,
            language: t.lang,
          })),
        );
        setCurrentAudioTrack(hls.audioTrack);

        setHlsSubtitleTracks(
          hls.subtitleTracks.map((t, i) => ({
            id: i,
            name: t.name || `Track ${i + 1}`,
            language: t.lang,
          })),
        );
        setCurrentSubtitleTrack(hls.subtitleTrack);

        video.play().catch(() => {});
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
        setCurrentAudioTrack(data.id);
      });

      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => {
        setCurrentSubtitleTrack(data.id);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setError(`Playback error: ${data.details}`);
          }
        }
      });

      hls.loadSource(activeUrl);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      isNativeRef.current = true;
      video.src = activeUrl;

      const onLoaded = () => {
        const audioTracks = (video as any).audioTracks as
          | { length: number; [i: number]: { label: string; language: string; enabled: boolean } }
          | undefined;
        if (audioTracks && audioTracks.length > 0) {
          const tracks: RuntimeTrack[] = [];
          let active = -1;
          for (let i = 0; i < audioTracks.length; i++) {
            tracks.push({
              id: i,
              name: audioTracks[i].label || audioTracks[i].language || `Track ${i + 1}`,
              language: audioTracks[i].language,
            });
            if (audioTracks[i].enabled) active = i;
          }
          setHlsAudioTracks(tracks);
          setCurrentAudioTrack(active);
        }

        if (video.textTracks && video.textTracks.length > 0) {
          const tracks: RuntimeTrack[] = [];
          let active = -1;
          for (let i = 0; i < video.textTracks.length; i++) {
            const tt = video.textTracks[i];
            if (tt.kind === 'subtitles' || tt.kind === 'captions') {
              tracks.push({
                id: i,
                name: tt.label || tt.language || `Track ${i + 1}`,
                language: tt.language,
              });
              if (tt.mode === 'showing') active = i;
            }
          }
          setHlsSubtitleTracks(tracks);
          setCurrentSubtitleTrack(active);
        }

        video.play().catch(() => {});
      };

      video.addEventListener('loadedmetadata', onLoaded, { once: true });
    } else {
      setError('HLS playback is not supported in this browser.');
    }

    return () => {
      destroyPlayer();
    };
  }, [activeUrl, destroyPlayer]);

  const handleSubmit = useCallback(
    async (inputUrl: string) => {
      setLoading(true);
      setError(null);
      setManifest(null);
      setActiveUrl(null);
      destroyPlayer();

      try {
        const res = await fetch(inputUrl, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = await res.text();
        const parsed = parseManifest(text, inputUrl);
        parsed.issues = validateManifest(parsed);
        setManifest(parsed);
        setMasterUrl(inputUrl);
        setActiveUrl(inputUrl);
      } catch (err: unknown) {
        if (err instanceof TypeError) {
          setError(
            'Failed to fetch the manifest. This is likely a CORS issue \u2014 the stream server must send Access-Control-Allow-Origin headers for your domain.',
          );
        } else {
          setError(
            err instanceof Error ? err.message : 'Failed to load manifest',
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [destroyPlayer],
  );

  const handlePlayVariant = useCallback((url: string) => {
    setError(null);
    setActiveUrl(url);
  }, []);

  const handlePlayMaster = useCallback(() => {
    setError(null);
    setActiveUrl(masterUrl);
  }, [masterUrl]);

  const handleSwitchAudio = useCallback((index: number) => {
    if (hlsRef.current && !isNativeRef.current) {
      hlsRef.current.audioTrack = index;
    } else if (isNativeRef.current && videoRef.current) {
      const tracks = (videoRef.current as any).audioTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].enabled = i === index;
        }
        setCurrentAudioTrack(index);
      }
    }
  }, []);

  const handleSwitchSubtitle = useCallback((index: number) => {
    if (hlsRef.current && !isNativeRef.current) {
      hlsRef.current.subtitleTrack = index;
    } else if (isNativeRef.current && videoRef.current) {
      for (let i = 0; i < videoRef.current.textTracks.length; i++) {
        videoRef.current.textTracks[i].mode =
          i === index ? 'showing' : 'disabled';
      }
      setCurrentSubtitleTrack(index);
    }
  }, []);

  const streamType = manifest
    ? manifest.liveStream?.isLive
      ? manifest.liveStream.isEvent ? 'EVENT' : manifest.liveStream.isDVR ? 'LIVE DVR' : 'LIVE'
      : manifest.endList ? 'VOD' : manifest.isMaster ? undefined : undefined
    : undefined;

  const audioTrackCount =
    manifest?.audioGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0;
  const captionTrackCount =
    (manifest?.subtitleGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0) +
    (manifest?.closedCaptionGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0);

  return (
    <div className="app">
      <header className="app__header">
        <h1>HLS Stream Debugger</h1>
        <p>Paste an HLS manifest URL to inspect and play the stream</p>
      </header>

      <UrlForm onSubmit={handleSubmit} loading={loading} />

      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading">
          <span className="spinner" />
          Loading manifest&hellip;
        </div>
      )}

      {manifest && (
        <div className="app__content">
          <div className="app__player-col">
            <VideoPanel ref={videoRef} hasSource={!!activeUrl} />

            {manifest.isMaster && manifest.variants.length > 0 && (
              <CollapsiblePanel
                title="Renditions"
                count={manifest.variants.length}
              >
                <RenditionList
                  variants={manifest.variants}
                  activeUrl={activeUrl}
                  masterUrl={masterUrl}
                  onPlayVariant={handlePlayVariant}
                  onPlayMaster={handlePlayMaster}
                />
              </CollapsiblePanel>
            )}
          </div>

          <div className="app__details-col">
            {manifest.issues.length > 0 && (
              <CollapsiblePanel title="Issues" count={manifest.issues.length}>
                <ManifestIssues issues={manifest.issues} />
              </CollapsiblePanel>
            )}

            <CollapsiblePanel title="Summary">
              <div className="summary-grid">
                <SummaryItem label="Type" value={manifest.isMaster ? 'Master' : 'Media'} />

                {streamType && (
                  <div className="summary-item">
                    <span className="summary-item__label">Stream</span>
                    <span className="summary-item__value">
                      <span className={`badge badge--${streamType === 'VOD' ? 'vod' : streamType === 'EVENT' ? 'event' : 'live'}`}>
                        {streamType}
                      </span>
                    </span>
                  </div>
                )}

                {manifest.version != null && (
                  <SummaryItem label="Version" value={String(manifest.version)} />
                )}

                {manifest.targetDuration != null && (
                  <SummaryItem label="Target Duration" value={`${manifest.targetDuration}s`} />
                )}

                {manifest.segmentAnalysis && (
                  <SummaryItem
                    label="Total Duration"
                    value={formatDuration(manifest.segmentAnalysis.totalDuration)}
                  />
                )}

                {manifest.segments.length > 0 && (
                  <SummaryItem label="Segments" value={String(manifest.segments.length)} />
                )}

                {manifest.isMaster && (
                  <SummaryItem label="Variants" value={String(manifest.variants.length)} />
                )}

                {manifest.encryption.isEncrypted && (
                  <div className="summary-item">
                    <span className="summary-item__label">Encryption</span>
                    <span className="summary-item__value">
                      <span className="badge badge--encrypted">
                        {manifest.encryption.method || 'Yes'}
                      </span>
                    </span>
                  </div>
                )}

                {(manifest.discontinuityCount ?? 0) > 0 && (
                  <SummaryItem label="Discontinuities" value={String(manifest.discontinuityCount)} />
                )}

                {manifest.discontinuitySequence != null && manifest.discontinuitySequence > 0 && (
                  <SummaryItem label="Disc. Sequence" value={String(manifest.discontinuitySequence)} />
                )}

                {manifest.independentSegments && (
                  <div className="summary-item">
                    <span className="summary-item__label">Independent Segments</span>
                    <span className="summary-item__value">
                      <span className="badge badge--vod">Yes</span>
                    </span>
                  </div>
                )}

                {manifest.start && (
                  <SummaryItem
                    label="Start Offset"
                    value={`${manifest.start.timeOffset}s${manifest.start.precise ? ' (precise)' : ''}`}
                  />
                )}

                {manifest.mediaSequence != null && manifest.mediaSequence > 0 && (
                  <SummaryItem label="Media Sequence" value={String(manifest.mediaSequence)} />
                )}
              </div>
            </CollapsiblePanel>

            {manifest.segmentAnalysis && (
              <CollapsiblePanel
                title="Segment Analysis"
                count={manifest.segments.length}
              >
                <SegmentAnalysis
                  analysis={manifest.segmentAnalysis}
                  targetDuration={manifest.targetDuration}
                  liveStream={manifest.liveStream}
                />
              </CollapsiblePanel>
            )}

            <CollapsiblePanel
              title="Audio Tracks"
              count={audioTrackCount || hlsAudioTracks.length}
            >
              <AudioTrackList
                manifestGroups={manifest.audioGroups}
                runtimeTracks={hlsAudioTracks}
                currentTrack={currentAudioTrack}
                onSwitch={handleSwitchAudio}
                hasPlayer={!!activeUrl}
              />
            </CollapsiblePanel>

            <CollapsiblePanel
              title="Captions & Subtitles"
              count={captionTrackCount || hlsSubtitleTracks.length}
            >
              <CaptionTrackList
                subtitleGroups={manifest.subtitleGroups}
                closedCaptionGroups={manifest.closedCaptionGroups}
                runtimeTracks={hlsSubtitleTracks}
                currentTrack={currentSubtitleTrack}
                onSwitch={handleSwitchSubtitle}
                hasPlayer={!!activeUrl}
              />
            </CollapsiblePanel>

            {manifest.encryption.isEncrypted && (
              <CollapsiblePanel title="Encryption Details">
                <EncryptionDetails encryption={manifest.encryption} />
              </CollapsiblePanel>
            )}

            {manifest.dateRanges.length > 0 && (
              <CollapsiblePanel title="Date Ranges" count={manifest.dateRanges.length}>
                <DateRangeList dateRanges={manifest.dateRanges} />
              </CollapsiblePanel>
            )}

            {manifest.lowLatency.hasLowLatency && (
              <CollapsiblePanel title="Low-Latency HLS">
                <LowLatencyPanel info={manifest.lowLatency} />
              </CollapsiblePanel>
            )}

            {manifest.iFramePlaylists.length > 0 && (
              <CollapsiblePanel title="I-Frame Playlists" count={manifest.iFramePlaylists.length}>
                <IFrameList playlists={manifest.iFramePlaylists} />
              </CollapsiblePanel>
            )}

            {manifest.segments.length > 0 && (
              <CollapsiblePanel
                title="Segment List"
                count={manifest.segments.length}
                defaultOpen={false}
              >
                <SegmentList
                  segments={manifest.segments}
                  targetDuration={manifest.targetDuration}
                />
              </CollapsiblePanel>
            )}

            {manifest.isMaster && (
              <CollapsiblePanel title="Sub-Manifests" count={manifest.variants.length} defaultOpen={false}>
                <SubManifests
                  variants={manifest.variants}
                  audioGroups={manifest.audioGroups}
                  subtitleGroups={manifest.subtitleGroups}
                />
              </CollapsiblePanel>
            )}

            <CollapsiblePanel title="Raw Manifest" defaultOpen={false}>
              <div className="raw-manifest">
                <pre>{manifest.raw}</pre>
              </div>
            </CollapsiblePanel>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label">{label}</span>
      <span className="summary-item__value">{value}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default App;
