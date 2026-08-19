---
applyTo: "src/js/apps/**,index.html,assets/icons/*.svg"
---
# Adding a new app to AndreOS

Follow this checklist end to end. The steps most often forgotten are marked
**⚠️ easy to forget** — registering an app in the catalog does **not** put it on
the desktop.

## 1. App folder — `src/js/apps/<id>/`
Use a stable lowercase `<id>` (e.g. `monitor`). It is the catalog id **and** the
window `data-file`/`data-action` value everywhere below.

- `content.js` — export `render()` returning the window's HTML string. Called
  fresh on every open.
- `index.js` — export `catalog` (an `AppManifest`) and, if the assistant should
  see it, `profile` (an `AssistantProfile`). Point `iconSvg` at the asset with
  `new URL('../../../../assets/icons/<id>.svg', import.meta.url).href`.
- `window.js` *(optional)* — export `setup<Name>Window(winEl)` and wire it via
  `window: { …, setup: (el) => setup<Name>Window(el) }` in the catalog.
- `context.js` *(optional)* — an assistant context provider (see step 6).

## 2. Register it — `src/js/apps/index.js` ⚠️ easy to forget
Import the module and add it to the `apps` array. **Order is significant** (it
drives search order, the "open app" keyword list, and the LLM app list).

## 3. Desktop icon — `index.html` ⚠️ easy to forget
Desktop icons are **static HTML**, not generated from the registry. Add a
`.desktop-icon` block inside `.desktop-icons` with `data-file="<id>"`. Without
this the app exists but never shows on the desktop.

## 4. Start-menu entry — `index.html` ⚠️ easy to forget
Add a `.start-menu-item` with `data-action="<id>"` under the Applications
`tree-children`. Both `data-file` and `data-action` must equal the catalog id —
they call `openFile(id)`.

## 5. Icon asset — `assets/icons/<id>.svg`
Match the existing style: `viewBox="0 0 24 24"`, `fill="none"`,
`stroke="currentColor"`, `stroke-width="2"`, round caps/joins. Icons are
recoloured to white via CSS, so use strokes, not fills.

## 6. Assistant integration *(optional)* — the `profile` in `index.js`
- `match` (regex) + `voiceKeywords` — how the assistant recognises "open <app>".
- `context: <provider>` — for on-screen Q&A. The provider exposes
  `getContextBlock(query)`; the window feeds it live/selected data. On focus the
  WindowManager sets the active app by id, and `chat.js` pulls the block into the
  system prompt. See `apps/research/context.js` and `apps/monitor/context.js`.
- `capabilities: [{ id, scope: 'when-active', invoke, … }]` — actions the AI can
  trigger. Expose the window's runtime API on `window.__<Name>App` and call it
  from `invoke`. See `apps/research/index.js`.

Desktop **search** needs no manual step: it auto-populates from the registry.
Set `searchable: true` and provide `search: { subtitle, keywords, icon? }`.

## 7. Styles — `src/css/styles.css`
Scope styles under an app-root class. Always use theme CSS variables
(`var(--surface-raised)`, `var(--text)`, `var(--border-soft)`, …) so **both
light and dark** work. Test dark mode explicitly — thin/low-alpha lines and
canvas graphs wash out on dark; use vivid colours, thicker strokes, and a glow.

## 8. Lifecycle & cleanup
There is **no teardown hook**. On close the window element is detached from the
DOM. Any `setInterval` / `requestAnimationFrame` / observer loop must
self-terminate by checking `winEl.isConnected` each tick (and clear its timer /
disconnect observers there).

## 9. Check it
- Non-trivial pure logic gets one runnable `*.selfcheck.mjs` beside the app
  (assert-based, no framework): `node src/js/apps/<id>/<id>.selfcheck.mjs`.
- Run `npm run build` — it must succeed.
