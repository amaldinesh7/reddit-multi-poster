# Post-Release TODO: Re-add PWA Support

> **Context:** PWA (`next-pwa`) was removed before the Feb 7 2026 release because its
> Service Worker was aggressively caching Next.js page JS chunks, which broke
> client-side (SPA) navigation -- the URL would change but the page content stayed
> on the previous page.

## What was removed

| Item | Details |
|---|---|
| Package | `next-pwa@^5.6.0` |
| Config | `withPWA()` wrapper in `next.config.js` with `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches` |
| SW management | Service worker auto-update `useEffect` in `_app.tsx` (controllerchange listener, periodic update, visibility-based update) |

## What was kept (safe improvements from the same commit)

- `<Link>` components in `AppHeader.tsx` and `MobileBottomNav.tsx` (correct Next.js pattern)
- `key={router.pathname}` on `<Component>` in `_app.tsx` (defensive React reconciliation fix)
- `ChunkLoadError` handler in `RouteProgressBar` (safety net for chunk load failures)
- Dynamic import of `ReviewPanel` in `index.tsx` (performance improvement)
- Idle-time prefetching removed (was tied to `router.push` pattern, replaced by `<Link>` auto-prefetch)

## Steps to re-add PWA properly

### 1. Install next-pwa

```bash
npm install next-pwa
```

### 2. Configure with runtimeCaching exclusions

The key fix: **exclude Next.js page/data chunks from SW caching** so SPA navigation
always gets fresh JS from the server.

```js
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // DO NOT cache page chunks -- this broke SPA navigation
      urlPattern: /\/_next\/static\/.+\.js$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "next-js-chunks",
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        },
      },
    },
    {
      // Cache static assets (images, fonts, CSS)
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico|woff2?)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      // API calls should always go to network
      urlPattern: /\/api\/.*/,
      handler: "NetworkOnly",
    },
  ],
});
```

### 3. Remove the SW unregister cleanup

Once PWA is properly configured, remove the `useEffect` in `_app.tsx` that
unregisters all service workers (lines 102-113 currently). It was added as a
cleanup measure for the broken SW.

### 4. Test thoroughly

- Navigate between all pages (home, settings, help, admin, privacy)
- Test on mobile (Android WebView, iOS Safari)
- Test the "add to home screen" PWA install flow
- Verify offline behavior is acceptable
- Confirm no stale content after deployments

### 5. Consider alternatives

- **Serwist** (`@serwist/next`) is the actively maintained fork of `next-pwa`
- Better defaults for Next.js page chunk caching
- See: https://serwist.pages.dev/docs/next/getting-started

## Related files

- `next.config.js` -- build pipeline config
- `pages/_app.tsx` -- SW cleanup + key prop
- `components/layout/AppHeader.tsx` -- navigation (Link components)
- `components/layout/MobileBottomNav.tsx` -- mobile navigation (Link components)
