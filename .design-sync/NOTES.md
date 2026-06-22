# Design Sync Notes

## Re-sync risks

- **Tailwind CSS**: `.design-sync/tailwind-built.css` must be refreshed when Tailwind config or global CSS changes. Run `npm run build` and copy `dist/assets/index-*.css` to `.design-sync/tailwind-built.css`. The filename changes on each build — update `cssEntry` in config if you rename it.

- **Default export synthesis**: The custom `source-kit.mjs` fork (`.design-sync/overrides/source-kit.mjs`) fixes the synthesis entry to re-export `export default` functions as named exports. If the upstream `lib/source-kit.mjs` changes significantly, re-apply the patch (the `DEFAULT_RX` block in the `!entry` branch).

- **PKG_DIR = repo root**: We pass `--entry ./frontend-dist/index.js` (a non-existent file) so the directory walk stops at the repo root and synthesis uses `frontend/src/components`. If you ever create `frontend-dist/index.js`, the build will try to use it as the real entry — delete it or update the `--entry` flag.

- **`frontend/package.json` name clash**: Both repo root and `frontend/` have `name: "bible-books-tracker"`. The fake `--entry` approach works around this; a real entry file inside `frontend/` would make PKG_DIR stop at `frontend/` instead of root, breaking `cssEntry` and `tsconfig` paths.

- **`virtual:pwa-register`**: Keep `srcDir` pointed at `frontend/src/components` (not `frontend/src`) to exclude `App.tsx` which imports this Vite-only virtual module.

- **PreviewProvider**: Wraps `ThemeProvider → AuthProvider → SyncProvider → MemoryRouter`. Required by NavBar (router), UserMenu (auth + router), SyncIndicator (sync context). Registered via `extraEntries` so it bundles into `window.BibleTracker.PreviewProvider`.

## Preview issues (needs-work on next sync)

- **SegmentedProgressBar**: Unread segments render at ~8% opacity on the dark background — barely visible at screenshot resolution. Fix: add `overrides.cardMode: "column"` to make the card wider and the bars more visible, or render in a slightly lighter background container.

- **FilterSelect**: Active `<select>` elements are not visually distinct from the dark `#0d1533` background in headless Chrome. Inactive state renders correctly. Fix: try rendering on a lighter background or use a forced light-mode wrapper.
