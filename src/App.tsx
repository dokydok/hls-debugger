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
import { RecordingControls } from './components/RecordingControls';
import { parseManifest } from './lib/parseManifest';
import { validateManifest } from './lib/validateManifest';
import { buildSnapshot, parseSnapshot, downloadSnapshot } from './lib/snapshot';
import { loadRecordingForPlayback } from './lib/recorder';
import type { ParsedManifest, RuntimeTrack } from './lib/types';

function getInitialUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get('url') ?? '';
  } catch {
    return '';
  }
}

function App() {
  const [initialUrl] = useState(getInitialUrl);
  const [manifest, setManifest] = useState<ParsedManifest | null>(null);
  const [masterUrl, setMasterUrl] = useState('');
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [mediaManifest, setMediaManifest] = useState<ParsedManifest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [localRecording, setLocalRecording] = useState(false);
  const [subManifestCache, setSubManifestCache] = useState<Record<string, string>>({});
  const recordingCleanupRef = useRef<(() => void) | null>(null);

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
    if (!activeUrl || snapshotMode) return;
    const video = videoRef.current;
    if (!video) return;

    destroyPlayer();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        liveSyncDurationCount: 3,
      });
      hlsRef.current = hls;
      isNativeRef.current = false;

      const syncTracks = () => {
        const at = hls.audioTracks;
        if (at.length > 0) {
          setHlsAudioTracks(at.map((t, i) => ({ id: i, name: t.name || `Track ${i + 1}`, language: t.lang })));
          setCurrentAudioTrack(hls.audioTrack);
        }
        const st = hls.subtitleTracks;
        if (st.length > 0) {
          setHlsSubtitleTracks(st.map((t, i) => ({ id: i, name: t.name || `Track ${i + 1}`, language: t.lang })));
          setCurrentSubtitleTrack(hls.subtitleTrack);
        }
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        syncTracks();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncTracks);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, syncTracks);
      hls.on(Hls.Events.LEVEL_LOADED, syncTracks);
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_, data) => setCurrentAudioTrack(data.id));
      hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_, data) => setCurrentSubtitleTrack(data.id));

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
  }, [activeUrl, destroyPlayer, snapshotMode]);

  useEffect(() => {
    if (snapshotMode) return;
    if (!manifest?.isMaster) {
      setMediaManifest(null);
      return;
    }

    const variantUrl =
      activeUrl && activeUrl !== masterUrl
        ? activeUrl
        : manifest.variants[0]?.uri;

    if (!variantUrl) {
      setMediaManifest(null);
      return;
    }

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const fetchMediaManifest = async () => {
      try {
        const res = await fetch(variantUrl, { mode: 'cors', cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseManifest(text, variantUrl);
        parsed.issues = validateManifest(parsed);
        setMediaManifest(parsed);

        // Update sub-manifest cache with latest text for this variant
        setSubManifestCache(prev => ({ ...prev, [variantUrl]: text }));

        // Schedule next poll for live streams
        if (!cancelled && parsed.liveStream?.isLive) {
          const interval = (parsed.liveStream.suggestedPollInterval ?? parsed.targetDuration ?? 6) * 1000;
          pollTimer = setTimeout(fetchMediaManifest, interval);
        }
      } catch {
        if (!cancelled) setMediaManifest(null);
      }
    };

    fetchMediaManifest();

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
  }, [activeUrl, masterUrl, manifest, snapshotMode]);

  // Poll non-master live manifests (single media playlist loaded directly)
  useEffect(() => {
    if (snapshotMode || !manifest || manifest.isMaster) return;
    if (!manifest.liveStream?.isLive) return;

    const manifestUrl = manifest.url;
    const interval = (manifest.liveStream.suggestedPollInterval ?? manifest.targetDuration ?? 6) * 1000;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(manifestUrl, { mode: 'cors', cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const text = await res.text();
        if (cancelled) return;
        const parsed = parseManifest(text, manifestUrl);
        parsed.issues = validateManifest(parsed);
        setManifest(parsed);
      } catch {
        // ignore fetch errors, try again next interval
      }

      if (!cancelled) {
        pollTimer = setTimeout(poll, interval);
      }
    };

    pollTimer = setTimeout(poll, interval);

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
    };
    // Only re-run when the URL or snapshot mode changes, not on every manifest update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotMode, manifest?.url, manifest?.isMaster, manifest?.liveStream?.isLive]);

  useEffect(() => {
    if (snapshotMode || !manifest?.isMaster) return;

    const uris: string[] = [];
    for (const v of manifest.variants) uris.push(v.uri);
    for (const g of manifest.audioGroups)
      for (const t of g.tracks) if (t.uri) uris.push(t.uri);
    for (const g of manifest.subtitleGroups)
      for (const t of g.tracks) if (t.uri) uris.push(t.uri);

    if (uris.length === 0) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.allSettled(
        uris.map(async (uri) => {
          const res = await fetch(uri, { mode: 'cors' });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { uri, text: await res.text() };
        }),
      );
      if (cancelled) return;
      const cache: Record<string, string> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') cache[r.value.uri] = r.value.text;
      }
      setSubManifestCache(cache);
    })();

    return () => { cancelled = true; };
  }, [manifest, snapshotMode]);

  const handleSubmit = useCallback(
    async (inputUrl: string) => {
      setLoading(true);
      setError(null);
      setManifest(null);
      setMediaManifest(null);
      setActiveUrl(null);
      setSnapshotMode(false);
      setLocalRecording(false);
      setSubManifestCache({});
      recordingCleanupRef.current?.();
      recordingCleanupRef.current = null;
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

        const params = new URLSearchParams(window.location.search);
        params.set('url', inputUrl);
        window.history.replaceState(null, '', `?${params}`);
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

  useEffect(() => {
    if (initialUrl) handleSubmit(initialUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleExport = useCallback(() => {
    if (!manifest) return;
    const snapshot = buildSnapshot({
      manifest,
      masterUrl,
      activeUrl,
      mediaManifest,
      subManifestCache,
    });
    downloadSnapshot(snapshot);
  }, [manifest, masterUrl, activeUrl, mediaManifest, subManifestCache]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const snap = parseSnapshot(json);

      destroyPlayer();
      setError(null);
      setLoading(false);

      const parsed = parseManifest(snap.masterPlaylistText, snap.masterUrl);
      parsed.issues = validateManifest(parsed);
      setManifest(parsed);
      setMasterUrl(snap.masterUrl);

      if (snap.mediaPlaylist) {
        const media = parseManifest(snap.mediaPlaylist.text, snap.mediaPlaylist.url);
        media.issues = validateManifest(media);
        setMediaManifest(media);
      } else {
        setMediaManifest(null);
      }

      setActiveUrl(snap.activePlaybackUrl ?? snap.masterUrl);
      setSubManifestCache(snap.subManifests ?? {});
      setSnapshotMode(true);

      const params = new URLSearchParams(window.location.search);
      params.delete('url');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import snapshot');
    }
  }, [destroyPlayer]);

  const handleImportZip = useCallback(async (file: File) => {
    try {
      destroyPlayer();
      recordingCleanupRef.current?.();
      setError(null);
      setLoading(true);

      const result = await loadRecordingForPlayback(file);
      recordingCleanupRef.current = result.cleanup;

      result.manifest.issues = validateManifest(result.manifest);
      setManifest(result.manifest);
      setMasterUrl(result.masterBlobUrl);
      setActiveUrl(result.masterBlobUrl);
      setMediaManifest(null);
      setSubManifestCache(result.subManifestCache);
      setSnapshotMode(false);
      setLocalRecording(true);
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      params.delete('url');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to import recording');
    }
  }, [destroyPlayer]);

  const details = mediaManifest ?? (manifest && !manifest.isMaster ? manifest : null);

  const isLive = details?.liveStream?.isLive ?? false;

  const streamType = details
    ? isLive
      ? details.liveStream?.isEvent ? 'EVENT' : details.liveStream?.isDVR ? 'LIVE DVR' : 'LIVE'
      : details.endList ? 'VOD' : undefined
    : undefined;

  const allIssues = [
    ...(manifest?.issues ?? []),
    ...(mediaManifest?.issues ?? []),
  ];

  const audioTrackCount =
    manifest?.audioGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0;
  const captionTrackCount =
    (manifest?.subtitleGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0) +
    (manifest?.closedCaptionGroups.reduce((n, g) => n + g.tracks.length, 0) ?? 0);

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__header-row">
          <h1>HLS Stream Debugger</h1>
          <div className="app__header-actions">
            {snapshotMode && (
              <span className="badge badge--snapshot">Offline Snapshot</span>
            )}
            {localRecording && (
              <span className="badge badge--vod">Local Recording</span>
            )}
            {manifest && !snapshotMode && !localRecording && (
              <RecordingControls
                manifest={manifest}
                masterUrl={masterUrl}
                needsPolling={isLive && !details?.liveStream?.isEvent}
                getPlaybackTime={() => videoRef.current?.currentTime ?? 0}
              />
            )}
            {manifest && (
              <button
                className="icon-btn"
                onClick={handleExport}
                title="Export snapshot"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p>Paste an HLS manifest URL to inspect and play the stream</p>
      </header>

      <UrlForm onSubmit={handleSubmit} loading={loading} initialUrl={initialUrl} onImport={handleImport} onImportZip={handleImportZip} />

      {manifest && masterUrl && (
        <div className="master-url-bar text-dim">
          <span className="truncate" title={masterUrl}>Master: {masterUrl}</span>
          <button
            className="icon-btn icon-btn--sm"
            onClick={() => navigator.clipboard.writeText(masterUrl)}
            title="Copy URL"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
      )}

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
            <VideoPanel
              ref={videoRef}
              hasSource={!snapshotMode && !!activeUrl}
              offlineMessage={snapshotMode ? 'Offline snapshot — playback not available' : undefined}
              isLive={isLive}
            />

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
                  playbackDisabled={snapshotMode}
                />
              </CollapsiblePanel>
            )}
          </div>

          <div className="app__details-col">
            {allIssues.length > 0 && (
              <CollapsiblePanel title="Issues" count={allIssues.length}>
                <ManifestIssues issues={allIssues} />
              </CollapsiblePanel>
            )}

            <CollapsiblePanel title="Summary">
              <div className="summary-grid">
                <SummaryItem label="Type" value={manifest.isMaster ? 'Master' : 'Media'} tooltip="Master playlists list variants; Media playlists contain segments" />

                {streamType && (
                  <div className="summary-item">
                    <span className="summary-item__label" title="VOD = complete recording, LIVE = ongoing stream, EVENT = append-only live">Stream</span>
                    <span className="summary-item__value">
                      <span className={`badge badge--${streamType === 'VOD' ? 'vod' : streamType === 'EVENT' ? 'event' : 'live'}`}>
                        {streamType}
                      </span>
                    </span>
                  </div>
                )}

                {manifest.version != null && (
                  <SummaryItem label="Version" value={String(manifest.version)} tooltip="EXT-X-VERSION; determines which HLS features are available" />
                )}

                {(details?.targetDuration ?? manifest.targetDuration) != null && (
                  <SummaryItem label="Target Duration" value={`${details?.targetDuration ?? manifest.targetDuration}s`} tooltip="EXT-X-TARGETDURATION; max allowed segment duration in seconds" />
                )}

                {details?.segmentAnalysis && (
                  <SummaryItem
                    label="Total Duration"
                    value={formatDuration(details.segmentAnalysis.totalDuration)}
                    tooltip="Sum of all segment durations"
                  />
                )}

                {(details?.segments.length ?? 0) > 0 && (
                  <SummaryItem label="Segments" value={String(details!.segments.length)} tooltip="Number of media segments in the playlist" />
                )}

                {manifest.isMaster && (
                  <SummaryItem label="Variants" value={String(manifest.variants.length)} tooltip="Number of quality levels (EXT-X-STREAM-INF entries)" />
                )}

                {(details?.encryption ?? manifest.encryption).isEncrypted && (
                  <div className="summary-item">
                    <span className="summary-item__label" title="EXT-X-KEY encryption method">Encryption</span>
                    <span className="summary-item__value">
                      <span className="badge badge--encrypted">
                        {(details?.encryption ?? manifest.encryption).method || 'Yes'}
                      </span>
                    </span>
                  </div>
                )}

                {((details?.discontinuityCount ?? manifest.discontinuityCount) ?? 0) > 0 && (
                  <SummaryItem label="Discontinuities" value={String(details?.discontinuityCount ?? manifest.discontinuityCount)} tooltip="Number of EXT-X-DISCONTINUITY tags; signals codec or timestamp changes" />
                )}

                {(details?.discontinuitySequence ?? manifest.discontinuitySequence) != null && (details?.discontinuitySequence ?? manifest.discontinuitySequence)! > 0 && (
                  <SummaryItem label="Disc. Sequence" value={String(details?.discontinuitySequence ?? manifest.discontinuitySequence)} tooltip="EXT-X-DISCONTINUITY-SEQUENCE; base for discontinuity numbering" />
                )}

                {manifest.independentSegments && (
                  <div className="summary-item">
                    <span className="summary-item__label" title="EXT-X-INDEPENDENT-SEGMENTS; each segment can be decoded independently">Independent Segments</span>
                    <span className="summary-item__value">
                      <span className="badge badge--vod">Yes</span>
                    </span>
                  </div>
                )}

                {manifest.start && (
                  <SummaryItem
                    label="Start Offset"
                    value={`${manifest.start.timeOffset}s${manifest.start.precise ? ' (precise)' : ''}`}
                    tooltip="EXT-X-START; suggested initial playback position"
                  />
                )}

                {(details?.mediaSequence ?? manifest.mediaSequence) != null && (details?.mediaSequence ?? manifest.mediaSequence)! > 0 && (
                  <SummaryItem label="Media Sequence" value={String(details?.mediaSequence ?? manifest.mediaSequence)} tooltip="EXT-X-MEDIA-SEQUENCE; sequence number of the first segment" />
                )}
              </div>
            </CollapsiblePanel>

            {details?.segmentAnalysis && (
              <CollapsiblePanel
                title="Segment Analysis"
                count={details.segments.length}
              >
                <SegmentAnalysis
                  analysis={details.segmentAnalysis}
                  targetDuration={details.targetDuration}
                  liveStream={details.liveStream}
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
                hasPlayer={!snapshotMode && !!activeUrl}
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
                hasPlayer={!snapshotMode && !!activeUrl}
              />
            </CollapsiblePanel>

            {(details?.encryption ?? manifest.encryption).isEncrypted && (
              <CollapsiblePanel title="Encryption Details">
                <EncryptionDetails encryption={details?.encryption ?? manifest.encryption} />
              </CollapsiblePanel>
            )}

            {(details?.dateRanges ?? manifest.dateRanges).length > 0 && (
              <CollapsiblePanel title="Date Ranges" count={(details?.dateRanges ?? manifest.dateRanges).length}>
                <DateRangeList dateRanges={details?.dateRanges ?? manifest.dateRanges} />
              </CollapsiblePanel>
            )}

            {(details?.lowLatency ?? manifest.lowLatency).hasLowLatency && (
              <CollapsiblePanel title="Low-Latency HLS">
                <LowLatencyPanel info={details?.lowLatency ?? manifest.lowLatency} />
              </CollapsiblePanel>
            )}

            {manifest.iFramePlaylists.length > 0 && (
              <CollapsiblePanel title="I-Frame Playlists" count={manifest.iFramePlaylists.length}>
                <IFrameList playlists={manifest.iFramePlaylists} />
              </CollapsiblePanel>
            )}

            {(details?.segments.length ?? 0) > 0 && (
              <CollapsiblePanel
                title="Segment List"
                count={details!.segments.length}
                defaultOpen={false}
              >
                <SegmentList
                  segments={details!.segments}
                  targetDuration={details!.targetDuration}
                />
              </CollapsiblePanel>
            )}

            {manifest.isMaster && (
              <CollapsiblePanel title="Sub-Manifests" count={manifest.variants.length} defaultOpen={false}>
                <SubManifests
                  variants={manifest.variants}
                  audioGroups={manifest.audioGroups}
                  subtitleGroups={manifest.subtitleGroups}
                  cache={subManifestCache}
                />
              </CollapsiblePanel>
            )}

            <CollapsiblePanel title="Raw Manifest" defaultOpen={false}>
              {details && details !== manifest && (
                <>
                  <div className="raw-manifest__label">Media Playlist</div>
                  <div className="raw-manifest">
                    <pre>{details.raw}</pre>
                  </div>
                  <div className="raw-manifest__label" style={{ marginTop: 12 }}>Master Playlist</div>
                </>
              )}
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

function SummaryItem({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="summary-item">
      <span className="summary-item__label" title={tooltip}>{label}</span>
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
