# AGENTS.md — Plexi-Web

## What this is

Pure vanilla HTML/CSS/JS frontend for "Plexi Digital Mall." No build step, no framework, no bundler. Every file is served as-is.

## Running locally

```bash
npx serve .
# or
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Architecture

### Load order matters

CSS (in this exact order):
`variables.css` → `base.css` → `neomorphism.css` → `components.css` → `animations.css`

JS (in this exact order):
`config.js` → `api.js` → `auth.js` → `state.js` → `ui.js` → `dashboard.js` / `map.js`

### Globals on `window`

All JS modules are IIFEs that expose a single global: `CONFIG`, `api`, `Auth`, `State`, `UI`, `Dashboard`, `MallMap`.

### API client quirks (`assets/js/api.js`)

- Base URL: `https://plexi-digital-mall-backend.vercel.app/api`
- Auth endpoints use query params: `/auth?action=login`, not `/auth/login`
- Backend wraps responses in `{ body: ... }` — `parseBody()` unwraps this automatically
- 401 responses clear localStorage and redirect to `login.html`
- All requests have a 15s timeout via `AbortSignal.timeout`
- Errors carry `.status` and `.data` properties

### Auth and routing (`assets/js/auth.js`)

- `Auth.requireRole('admin')` — call at top of every dashboard page
- `Auth.requireGuest()` — call on login/signup to redirect if already logged in
- Role-based redirects use `REPO_NAME = 'Plexi-Web'` (hardcoded for GitHub Pages base path)
- Session stored in localStorage: keys `authToken` and `plexiUser`

### Dashboard pages (`dashboard/*.html`)

- Each calls `Auth.requireRole(role)` + `Dashboard.init()` on load
- Section navigation: buttons with `data-section="sectionId"`, sections are `.dash-section` divs
- `Dashboard.showSection(id)` handles nav + scroll + animation
- Notifications poll every 60s automatically

### Design system

Neomorphic CSS classes: `.neo`, `.neo-inset`, `.neo-flat`, `.neo-card`, `.btn-neo-primary`

Animation utilities: `.animate-fadeIn`, `.animate-fadeInUp`, `.animate-scaleIn`, `.animate-bounceIn`, `.hover-lift`, `.stagger-child`

Currency is South African Rand — `UI.formatCurrency()` outputs `R123.45`.

### Utility scripts (not part of the app)

- `_shot.js`, `_render_dashboards.js`, `_render_check.js` — Playwright screenshot tools (dev-only, hardcoded local paths)
- `audit_dashboard_classes.py` — checks HTML for CSS classes missing from `assets/css/`
- `package-lock.json` is empty; no npm dependencies

## Gotchas

- No tests, no linting, no CI — verify changes visually or via the Playwright screenshot scripts
- Dashboard HTML files are large single-page files (~800+ lines each); edit surgically
- `api.js` error handling: non-OK responses throw `Error` with `.status` and `.data` attached — always catch and use `err.message` for user-facing toasts
- Store/product pages use `?id=` query params, not path-based routing
- The mall map is a 10×10 grid — `MallMap.initPlacement(storeId)` enables click-to-place for sellers
