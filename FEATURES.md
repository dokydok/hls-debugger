# HLS Debugger — Feature Roadmap

Proposed features to enhance debugging, testing, and analysis of HLS streams.
Each feature can be planned and implemented independently.

---

## High-Value Debugging Features

### 1. Network Waterfall / Segment Timeline `[not implemented]`
Visual timeline showing when each segment was fetched, its download duration, and size. Similar to Chrome DevTools' network tab but HLS-aware — segments displayed on a horizontal timeline, color-coded by status (success, slow, failed, cached). Hovering shows details (URL, response time, content-type, size).

**Use case:** Diagnosing buffering, CDN latency spikes, and bandwidth bottlenecks. Answers "why did the player stall at 2:30?"

**Approach:** Hook into hls.js fragment loading events (`FRAG_LOADING`, `FRAG_LOADED`, `FRAG_LOAD_EMERGENCY_ABORTED`) to collect timing data. Render as a horizontal bar chart using CSS or a lightweight canvas library.

**Complexity:** Medium — requires hls.js event integration and a new visualization component.

---

### 2. Bitrate Ladder Visualization `[implemented]`
SVG scatter chart plotting all renditions by resolution height (y-axis) vs bitrate (x-axis, log scale). Color-coded by video codec. Highlights:
- Large bitrate gaps (>3x between adjacent renditions) — dashed orange warning lines
- Near-duplicate renditions (same resolution, bandwidth within 10%) — orange ring
- Audio-only variants shown at bottom row
- Legend with codec colors and issue counts

**Implementation:** `src/components/BitrateLadder.tsx` — pure SVG, no external charting library. Shown inside the Renditions panel when 2+ variants exist. Uses `parseCodecs` from `src/lib/codecParser.ts` for codec color-coding.

---

### 3. Manifest Diff (Live Polling) `[implemented]`
Inline diff showing what changed between consecutive manifest polls. For live streams:
- New lines added (highlighted green with `+` marker)
- Lines removed / fell off the window (highlighted red with `−` marker)
- Dropdown to browse last 30 poll diffs with timestamps and change counts
- Only appears for live streams after the first manifest update

**Implementation:** `src/components/ManifestDiff.tsx` with `computeDiff()` for line-based diffing. History stored in App.tsx state (`manifestDiffHistory`), computed on each live poll cycle. Shown in its own collapsible panel in the details column.

---

### 4. Segment Inspector / Probe `[not implemented]`
Click any segment in the segment list to fetch and inspect its binary contents:
- Container format detection (MPEG-TS vs fMP4/CMAF)
- Codecs present (video codec, audio codec)
- Keyframe positions and intervals (GOP structure)
- Actual segment duration vs declared duration
- PTS/DTS timestamps (detect drift/gaps)
- Muxed vs demuxed (audio+video together or separate)
- For fMP4: box structure (moov, moof, mdat sizes)

**Use case:** Debugging A/V sync issues, discontinuity problems, muxing errors, and segment duration mismatches. Answers "is the segment actually what the manifest says it is?"

**Approach:** Fetch segment as ArrayBuffer, parse TS headers or MP4 boxes. For TS: look for PAT/PMT/PES headers. For MP4: walk the box tree. Could use a library like `mux.js` for TS parsing or write a lightweight MP4 box walker.

**Complexity:** High — requires binary format parsing. Could be implemented incrementally (basic container detection first, then deeper inspection).

---

### 5. Stream Health Monitor `[not implemented]`
Real-time dashboard for live streams with key metrics:
- Manifest poll latency (ms per fetch, trend graph)
- Segment download throughput (Mbps)
- Playlist staleness (time since a new segment appeared)
- Discontinuity rate (discontinuities per minute)
- Key rotation frequency
- Buffer health (if hls.js exposes it)
- Alert indicators: red when manifest stops updating, when segments exceed target duration, when download speed drops below required bitrate

**Use case:** Monitoring a live stream over time to catch degradation. Leave it running and glance at the dashboard. Like a mini-Grafana for a single HLS stream.

**Approach:** Collect metrics from the existing live polling loop and hls.js events. Store time-series data in state. Render as sparkline graphs or simple number-with-trend indicators.

**Complexity:** Medium-high — needs time-series collection, multiple metric sources, and a dashboard layout.

---

### 6. Codec String Parser `[implemented]`
Parse the `CODECS` attribute from each rendition into human-readable format:
- `avc1.640028` → "H.264 High L4.0"
- `mp4a.40.2` → "AAC-LC"
- `hvc1.1.6.L120.90` → "HEVC Main L4.0"
- `ec-3` → "E-AC-3 (Dolby Digital Plus)"
- `flac` → "FLAC"

Shows browser compatibility via `MediaSource.isTypeSupported()`. Flags unsupported codecs in red on each rendition.

**Implementation:** `src/lib/codecParser.ts` — supports H.264, HEVC, AV1, VP9, VP8, AAC (LC/HE/HEv2/xHE), AC-3, E-AC-3, Opus, FLAC, ALAC, DTS, MP3, WebVTT, TTML. Integrated into `RenditionList.tsx` and `IFrameList.tsx`. Raw codec string shown in tooltip.

---

## Medium-Value Features

### 7. ABR Simulation `[not implemented]`
Simulate how different ABR algorithms would behave with this stream's bitrate ladder under configurable network conditions:
- Input: bandwidth profile (constant, fluctuating, step-down, 3G/4G/5G presets, custom curve)
- Output: timeline showing which rendition would be selected at each point, predicted buffer level, estimated quality switches

**Use case:** Testing whether a bitrate ladder works well under real-world conditions without needing actual devices. Answers "will users on 3G get a watchable experience?"

**Complexity:** Medium-high — needs ABR algorithm implementation and interactive bandwidth profile editor.

---

### 8. Manifest Editor / Playground `[not implemented]`
Split-pane editor: raw M3U8 text on the left, parsed visualization on the right. Edit the text and see the parsed result update in real-time. Features:
- Syntax highlighting for HLS tags
- Auto-completion for common tags
- "Generate minimal manifest" templates
- Validate-as-you-type with inline error markers

**Use case:** Testing manifest changes without re-encoding. Learning HLS syntax. Creating test manifests for player testing.

**Complexity:** Medium — needs a code editor component (CodeMirror/Monaco) and bidirectional sync.

---

### 9. SCTE-35 Ad Marker Analyzer `[not implemented]`
Dedicated panel for ad insertion analysis:
- Timeline view of all CUE-OUT/CUE-IN pairs with durations
- Gap detection (CUE-OUT without matching CUE-IN)
- Duration validation (declared ad break duration vs actual)
- SCTE-35 binary payload decoding from EXT-X-DATERANGE (if present)
- Overlap detection (nested or overlapping ad breaks)
- Summary: total ad time, ad break count, average break duration

**Use case:** Ad insertion is one of the most complex and error-prone parts of HLS. This saves hours of manual manifest reading. Critical for SSAI/CSAI debugging.

**Complexity:** Medium — builds on existing CUE parsing. SCTE-35 binary decoding is optional and adds complexity.

---

### 10. Multi-Stream Comparison `[not implemented]`
Load two streams side-by-side and compare:
- Bitrate ladder differences
- Segment duration patterns
- Encryption method differences
- Codec choices
- Validation issues unique to each
- Side-by-side playback (sync'd or independent)

**Use case:** Comparing staging vs production, before/after a transcoding change, or competitor analysis.

**Complexity:** High — needs dual-stream state management and comparison logic. Could start simple with just "compare rendition lists."

---

### 11. Thumbnail / Preview Extraction `[not implemented]`
Extract and display keyframe images from the stream:
- Use I-frame playlists if available
- Otherwise fetch segments and extract first keyframe
- Display as a filmstrip/storyboard
- Show what the seek preview would look like

**Use case:** Verifying that I-frame playlists are correct, checking thumbnail quality, validating seek preview behavior.

**Complexity:** High — requires video frame extraction (Canvas + video element trick or WASM decoder).

---

### 12. DRM / Encryption Analyzer `[not implemented]`
Deep inspection of encryption and DRM:
- Fetch and display key file contents (AES-128 keys in hex)
- Detect key rotation patterns and visualize which segments share keys
- Validate every encrypted segment has a corresponding key
- For SAMPLE-AES: show encryption scheme details
- For Widevine/FairPlay: parse PSSH box contents from init segments, show license server URL

**Use case:** Debugging DRM playback failures, key delivery issues, and encryption configuration problems.

**Complexity:** Medium-high — key fetching is simple, PSSH parsing requires MP4 box walking.

---

## Lower-Priority but Useful

### 13. Share Analysis Link `[not implemented]`
Generate a shareable URL that includes the stream URL and current view state:
- Which panels are open/closed
- Which rendition is selected
- Scroll position in segment list
- Any active filters

**Use case:** Sharing a specific analysis view with a colleague — "look at segment #47 in this stream."

**Complexity:** Low — encode panel state in URL hash or additional query params.

---

### 14. Accessibility Audit `[not implemented]`
Check subtitle/caption tracks for completeness:
- Presence of subtitle tracks across all variants
- Language coverage (flag missing common languages)
- Format detection (WebVTT vs EIA-608/708)
- Forced vs non-forced flag validation
- Closed caption track vs subtitle track distinction
- FCC compliance indicators

**Use case:** Ensuring streams meet accessibility requirements before deployment.

**Complexity:** Low — uses existing parsed data, just needs analysis logic and a report panel.

---

### 15. Content Steering Panel `[not implemented]`
Parse and display `EXT-X-CONTENT-STEERING` directives:
- Server URI for steering manifest
- Pathway ID and pathway priority
- Fetch and display the steering manifest JSON
- Show which CDN pathway would be selected

**Use case:** Debugging multi-CDN setups with content steering. Understanding pathway selection.

**Complexity:** Low — data partially available from m3u8-parser, needs extraction and a small panel.

---

### 16. Session Data Panel `[not implemented]`
Display `EXT-X-SESSION-DATA` and `EXT-X-SESSION-KEY` tags:
- Data ID, value, URI, language
- Session key method, URI, IV
- Show how session data relates to media playlists

**Use case:** Understanding session-level metadata and shared encryption configuration.

**Complexity:** Low — needs parser extraction and a simple display panel.

---

### 17. Segment Gap Detection `[not implemented]`
Detect and highlight `EXT-X-GAP` tags:
- Flag gap segments in the segment list with a visual indicator
- Summary: total gap count, total gap duration, gap positions in timeline
- Validate gap handling (gaps should not break playback)

**Use case:** Identifying missing content in streams, understanding gap-based ad insertion.

**Complexity:** Low — `EXT-X-GAP` data may already be in the parser, just needs surfacing.

---

### 18. Variable Substitution Display `[not implemented]`
Parse `EXT-X-DEFINE` tags and show:
- Variable name → value mappings
- Where variables are used in the manifest (highlighted in raw view)
- Resolved vs unresolved variable references

**Use case:** Debugging template-based manifest generation systems where URIs use variable substitution.

**Complexity:** Low — regex-based variable detection in raw manifest text.

---

## Recommended Implementation Order

These four features give the most debugging value with reasonable implementation effort:

1. **Codec String Parser** (#6) `[implemented]` — small scope, high daily value, no new dependencies
2. **Bitrate Ladder Visualization** (#2) `[implemented]` — visual, helps catch common encoding issues fast
3. **Manifest Diff for Live** (#3) `[implemented]` — leverages existing live polling, very useful for live debugging
4. **SCTE-35 Analyzer** (#9) — ad insertion is one of the most common debugging scenarios
