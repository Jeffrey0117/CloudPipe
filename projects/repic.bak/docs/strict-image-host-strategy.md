# Strict Image Host Strategy (postimg.cc etc.)

## Problem

Some image hosting sites (e.g. `postimg.cc`) aggressively block non-browser requests:
- Direct `fetch()` → CORS error
- Node.js `https.get()` with full browser headers → HTTP 403
- curl with User-Agent, Referer, Sec-Fetch-* headers → HTTP 403
- Third-party image proxies (wsrv.nl) → 400/403
- `<img src={url}>` in Electron → loads a **placeholder image** (not an error), so `onError` never fires
- Hidden BrowserWindow loading the image URL directly → still 403

These sites use server-side protection (likely nginx-level) that checks for a valid browsing session context, not just HTTP headers.

## Solution: 3-Layer Fallback Chain

```
Layer 1: fetch() with no-referrer
   ↓ fails (CORS/403)
Layer 2: Node.js proxy (electron main process, https module)
   ↓ fails (HTTP 403)
Layer 3: Browser proxy (hidden BrowserWindow loads HOST PAGE, extracts image from DOM)
   ↓ success (page JS runs normally, image loads in page context)
```

### Layer 3 Detail: Browser Proxy

The key insight: **strict sites serve images fine within their own page context**. So instead of requesting the image directly, we:

1. Map image URL to page URL: `https://i.postimg.cc/pVk9mCkX/img.jpg` → `https://postimg.cc/pVk9mCkX`
2. Open a hidden `BrowserWindow` and navigate to the page URL
3. Wait for page JS to initialize and images to load
4. Find the largest `<img>` element in the DOM (the main content image)
5. Draw it to a `<canvas>` and extract as base64 via `toDataURL()`
6. Return the base64 data to the renderer process

### Critical Implementation Details

- **`webSecurity: false`** on the hidden window — required to allow `canvas.toDataURL()` on cross-origin images (`i.postimg.cc` ≠ `postimg.cc`)
- **Queue mechanism** — only one hidden window at a time, to avoid rate limiting by the target site
- **Result caching** — same URL won't spawn a second hidden window
- **15-second timeout** — prevents hanging on broken pages
- **Polling with retry** — checks for loaded images every 500ms, up to 30 attempts

## Strategies We Tried (and Why They Failed)

| Strategy | Result | Why |
|----------|--------|-----|
| `fetch()` with no-referrer | CORS error | Browser enforces CORS |
| Node.js `https` with browser UA + Referer + Sec-Fetch | 403 | Server detects non-browser |
| curl with full browser header set | 403 | No JS execution context |
| `<img src={url}>` directly | Shows placeholder, not error | 403 response is a valid PNG (blue "Upgrade to Premium" image) |
| wsrv.nl / weserv.nl image proxy | 400 | Proxy also gets blocked |
| Hidden BrowserWindow loading image URL directly | 403 | Still no page context |
| Hidden BrowserWindow loading **page URL** + canvas extract | **Success** | Full browser env with page context |

## The `<img>` Trap

The most subtle gotcha: postimg returns HTTP 403 **with a valid image body** (their placeholder PNG). This means `<img onError>` never fires — the browser considers it a successfully loaded image. Our initial "Strategy 4" (just use `<img>`) appeared to work but actually displayed the wrong image.

This is why we must use `fetch()` as the first layer — it correctly detects HTTP 403 as an error, triggering the fallback chain.

## Adding New Strict Sites

To support a new strict host:

1. Add URL mapping in `imageUrlToPageUrl()` (`electron/main.cjs`)
2. The rest of the pipeline (queue, canvas extraction, caching) is generic

```javascript
// Example: adding a hypothetical strict host
if (urlObj.hostname === 'img.example.com') {
    const id = urlObj.pathname.split('/')[1];
    return `https://example.com/view/${id}`;
}
```

## Architecture

```
Renderer (LazyImage / ImageViewer)
  │
  ├─ Layer 1: fetch() ──────────────────── Fast, handles most sites
  │
  ├─ Layer 2: IPC 'proxy-image' ────────── Node.js https, bypasses CORS
  │
  └─ Layer 3: IPC 'proxy-image-browser' ── Hidden BrowserWindow
       │
       ├─ enqueueBrowserProxy() ──── One at a time (queue)
       ├─ browserProxyCache ──────── Skip if already fetched
       └─ executeBrowserProxy() ──── Open page → poll DOM → canvas → base64
```

## Core Takeaway

**You can't out-header a strict image host.** No combination of User-Agent, Referer, Accept, Sec-Fetch-* headers will work if the server requires a full browsing session. The only reliable approach is to **load their page in a real browser context and extract the image from the rendered DOM**. Electron's hidden BrowserWindow makes this possible without any external dependencies.
