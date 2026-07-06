# PWA and Mobile Standard

## Mobile-first rules

- Design for `320px` width first.
- Do not allow horizontal overflow.
- Buttons must be large enough for touch.
- Tables must collapse, scroll safely, or switch to stacked cards on small screens.
- Inputs should not trigger mobile zoom, so use `16px` font size or equivalent on small screens.

## Current Report Lab PWA behavior

- Service worker registration is production-only.
- The app re-checks for updates when the tab becomes visible.
- A new service worker triggers a one-time reload.
- The manifest is served from `public/manifest.webmanifest`.
- The server also aliases `/manifest.json` to the built manifest.

## Exact manifest values

- Name: `SSAMENJ Technologies`
- Short name: `SSAMENJ`
- Display: `standalone`
- Start URL: `/`
- Scope: `/`
- Orientation: `portrait-primary`
- Theme color: `#0B5CFF`
- Background color: `#ffffff`

## Exact mobile hardening values

- `html`, `body`, and `#root` use `width: 100%`, `max-width: 100%`, and `min-width: 0`
- `body` sets `overscroll-behavior-x: none`
- `body` sets `touch-action: pan-y`
- `img`, `svg`, `canvas`, `video`, and `iframe` use `max-width: 100%`
- `main`, `section`, `article`, `aside`, `header`, `footer`, `nav`, `.app`, `.app-shell`, `.page`, `.page-shell`, `.content`, `.container`, `.card`, and `.panel` use `min-width: 0`
- Safe-area padding is applied to the topbar, sidebar, and page container
- The dev overflow detector warns when the page becomes wider than the viewport

## Device checklist

- Samsung S24
- Samsung A50
- Samsung A20

## PWA asset rules

- Provide 192px and 512px icons.
- Provide maskable icons.
- Provide an Apple touch icon.
- Keep the manifest and icon files in sync.

## Offline behavior rules

- Offline support must never block the core app when the service worker fails.
- API requests must not be cached by the service worker.
- Cross-origin requests must not be intercepted.

