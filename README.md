# HLS Stream Debugger

A browser-based tool for inspecting and playing HLS streams. Paste an `.m3u8` URL to parse the manifest, view all variants/renditions, alternate audio tracks, subtitle/closed-caption tracks, and play any rendition individually.

Works on Chrome (via hls.js / MSE) and Safari / iOS (native HLS). Responsive for mobile devices.

## Development

```bash
nvm use 22
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/` — deploy as a static site.

## Deploy

Hosted on [Vercel](https://vercel.com). Push to `main` to trigger a deploy (if connected), or run `vercel` from the project root.

## CORS

The stream server must send `Access-Control-Allow-Origin` headers that permit your domain. Without CORS, manifest fetching and playback will fail in the browser.
