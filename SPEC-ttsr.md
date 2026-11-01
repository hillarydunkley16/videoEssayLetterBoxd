# Spec: Time to Start Render (TTSR) for the Web Build

## Objective

Cut the time before the web app paints its first pixel. Today `app/_layout.tsx` returns `null` until Clerk's `isLoaded` is true, and `app/+html.tsx` loads Google Fonts through a render-blocking `<link rel="stylesheet">`. The pre-rendered static HTML therefore paints nothing useful until JS has downloaded, hydrated, and Clerk has loaded.

**Users:** beta users opening the Render-hosted web app (`videoessay-web`) on mobile-width and desktop browsers.

**Out of scope:** native iOS/Android startup, bundle splitting / async routes (follow-up if the target is missed), backend latency.

## Success Criteria

Measured with Lighthouse (mobile profile: Slow 4G, 4x CPU) against a production build served from `frontend/dist/` and again against the deployed URL:

- Start Render < 1.5s; FCP < 1.8s
- Baseline captured **before** any change and recorded in `tasks/todo-ttsr.md` for before/after comparison
- First paint shows the themed background and app shell (nav + skeleton), not a blank page
- No layout shift when fonts swap or Clerk loads (CLS < 0.1)
- No request to `fonts.googleapis.com` / `fonts.gstatic.com` on page load
- Hashed assets under `/_expo/static/*` are served with `Cache-Control: public, max-age=31536000, immutable`; `*.html` with `max-age=0, must-revalidate`
- Signed-in and signed-out flows behave as before (auth gating, redirects, share intent unchanged)
- `npx tsc --noEmit`, `npm run lint`, `npm test`, `npx expo export --platform web` all pass

## Assumptions

1. Web only; native keeps its current `fontsLoaded` gate and splash screen.
2. Fonts stay Fraunces and Inter, self-hosted as `woff2`.
3. No new runtime dependencies.
4. Render's static-site CDN already compresses responses; only cache headers are added.

## Tech Stack

Expo (expo-router, `web.output: "static"`, Metro bundler), React Native Web, `@clerk/clerk-expo`, deployed as a Render static site via `render.yaml`.

## Commands

```
cd frontend
npm ci --legacy-peer-deps
npx expo export --platform web          # build -> frontend/dist/
npx serve dist -l 4173                  # serve the production build locally
npx tsc --noEmit
npm run lint
npm test
npx lighthouse http://localhost:4173 --preset=perf --form-factor=mobile \
  --throttling-method=simulate --output=json --output-path=./lh.json
```

For real-network numbers, run WebPageTest or the Chrome DevTools Lighthouse audit against the deployed `videoessay-web` URL.

## Project Structure

```
frontend/app/+html.tsx             -> web document shell: critical CSS, font preload/@font-face
frontend/app/_layout.tsx           -> root layout: remove the web null-gate on Clerk isLoaded
frontend/public/fonts/             -> self-hosted Fraunces + Inter woff2 (web); Expo copies public/ into dist/
frontend/components/ui/            -> shell skeleton component (new, web pre-auth)
frontend/constants/theme.ts        -> source of background colors for critical CSS
render.yaml                        -> videoessay-web `headers` block
tasks/plan-ttsr.md, tasks/todo-ttsr.md -> plan, tasks, baseline + after measurements
```

## Code Style

Match the existing files: function components, `Platform.OS === 'web'` branching inside the component, comments only where the *why* is non-obvious.

```tsx
function RootLayoutNav() {
  const { isLoaded } = useAuth();
  const { loaded: fontsLoaded } = useAppFonts();
  const theme = Colors[useColorScheme()];
  // Native waits on fonts; web paints the shell immediately and lets
  // auth-dependent parts wait on Clerk instead of blanking the page.
  if (Platform.OS !== 'web' && (!isLoaded || !fontsLoaded)) return null;
  ...
}
```

## Testing Strategy

- **Regression gates:** `tsc --noEmit`, `expo lint`, `expo export --platform web`, and the existing jest Prove-It test must pass unchanged.
- **New jest test (RTL, jest-expo):** with `useAuth` mocked to `isLoaded: false` and `Platform.OS = 'web'`, `RootLayoutNav` renders the nav shell (not `null`). With `Platform.OS = 'ios'` and `isLoaded: false`, it still renders `null`.
- **`render.yaml` guard:** extend the `test_render_blueprint.py` pattern (backend, per-concern file, e.g. `test_render_blueprint_headers.py`) to assert the `videoessay-web` service defines the immutable-cache header for `/_expo/static/*`.
- **Performance verification (manual, recorded):** Lighthouse before/after on the built `dist/`, then on the deployed URL. Results go in `tasks/todo-ttsr.md`.

## Boundaries

- **Always:** capture a baseline before changing anything; verify each step with a Lighthouse run; keep native behavior unchanged; keep the backend URL resolved only in `src/api/client.ts`.
- **Ask first:** adding any dependency; changing `render.yaml` beyond the `headers` block; changing the Clerk provider setup or token cache; adding font weights not currently used.
- **Never:** hardcode a Clerk issuer, host, or secret; weaken or skip existing tests/lint to get green; edit applied migrations; hide the auth gate in a way that exposes signed-in-only UI to signed-out users.

## Implementation Order (for the Plan phase)

1. Baseline measurement (Lighthouse on local `dist/` + deployed URL).
2. `_layout.tsx`: stop gating web paint on Clerk; add pre-auth shell skeleton; add the jest test.
3. `+html.tsx`: inline critical CSS (themed background, shell placeholder, dark-mode variant).
4. Fonts: self-host woff2, `@font-face` with `font-display: swap`, preload above-the-fold weights, remove the Google Fonts link. Use size-adjusted fallbacks to avoid CLS.
5. `render.yaml` cache headers + blueprint test.
6. After measurement; record results; decide whether bundle splitting follow-up is needed.

## Open Questions

- Which exact font weights are used above the fold (to decide what to preload)? Needs a check of component styles.
- Does the signed-out landing route redirect on the client after Clerk loads? If so, the skeleton must not flash the wrong page before the redirect.
- Is the deployed URL on a custom domain yet? It affects whether real-network measurements are representative.
