---
name: add-hls-panel
description: Add a new feature panel to the HLS Stream Debugger. Use when asked to display new HLS metadata, add a new manifest section, create a new info panel, or extend the debugger with additional stream details.
---

# Add a new HLS debugger panel

Follow these steps to add a panel that surfaces new information from the manifest or player.

## 1. Define types in `src/lib/types.ts`

Add any new fields to `ParsedManifest`, or create new interfaces if the data is complex. Keep types adjacent to the existing `Variant`, `MediaTrack`, and `MediaTrackGroup` definitions.

## 2. Extract data in `src/lib/parseManifest.ts`

Parse the new fields from `parser.manifest` and populate the types from step 1. Use `resolveUrl()` for any URIs. Return the data as part of the `ParsedManifest` object.

Reference the m3u8-parser manifest shape in `src/m3u8-parser.d.ts` — extend it if the parser exposes fields not yet declared there.

## 3. Create the component in `src/components/`

Follow the track-list pattern used by `AudioTrackList.tsx` and `CaptionTrackList.tsx`:

```tsx
import type { ... } from '../lib/types';

interface Props {
  // manifest-level data
  // runtimeTracks / currentTrack / onSwitch if the panel has player controls
  hasPlayer: boolean;
}

export function MyNewPanel({ ... }: Props) {
  // 1. Empty state: return <p className="notice">...</p>
  // 2. Runtime controls (if applicable): <button className="track-item">
  // 3. Manifest info: <div className="track-item track-item--info">
}
```

Use existing CSS classes (`.track-list`, `.track-item`, `.badge`, `.group-label`). Only add new classes to `src/index.css` if the existing ones don't cover the layout.

## 4. Wire into `src/App.tsx`

1. Import the new component.
2. If the panel needs runtime player data, add state (`useState`) and populate it in the `MANIFEST_PARSED` handler. Reset it in `destroyPlayer()`.
3. If the panel needs a track-switching callback, add a `handleSwitchX` function following the dual hls.js/native pattern.
4. Render the component inside a `CollapsiblePanel` in the `app__details-col`:

```tsx
<CollapsiblePanel title="Panel Title" count={itemCount}>
  <MyNewPanel
    manifestData={manifest.newField}
    runtimeTracks={...}
    currentTrack={...}
    onSwitch={handleSwitchX}
    hasPlayer={!!activeUrl}
  />
</CollapsiblePanel>
```

## 5. Add CSS if needed

Append new classes to `src/index.css`, following the existing naming and token conventions. Prefer reusing `.track-item`, `.badge`, `.summary-item` etc. over creating new structures.

## Checklist

- [ ] Types added to `types.ts`
- [ ] Parser updated in `parseManifest.ts`
- [ ] Component created in `src/components/`
- [ ] Component uses existing CSS classes where possible
- [ ] Wired into `App.tsx` inside a `CollapsiblePanel`
- [ ] Runtime state reset in `destroyPlayer()` (if applicable)
- [ ] Build passes (`npm run build`)
