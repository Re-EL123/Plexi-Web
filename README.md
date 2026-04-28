# Plexi Digital Mall — Frontend

Production-ready vanilla HTML/CSS/JS frontend for the Plexi Digital Mall platform.

## Project Structure

```
plexi-digital-mall-frontend/
├── index.html                  # Public landing page
├── login.html                  # Login page
├── signup.html                 # Registration page
│
├── dashboard/
│   ├── admin.html              # Admin dashboard (role-gated)
│   ├── seller.html             # Seller dashboard (role-gated)
│   └── shopper.html            # Shopper dashboard (role-gated)
│
├── store/
│   ├── store.html              # Public store page (?id=)
│   └── product.html            # Product detail page (?id=)
│
├── assets/
│   ├── css/
│   │   ├── variables.css       # Design tokens (colors, spacing, shadows)
│   │   ├── base.css            # Reset, typography, layout utilities
│   │   ├── neomorphism.css     # Neomorphic shadow system
│   │   ├── components.css      # All UI components
│   │   └── animations.css      # Keyframes & animation utilities
│   │
│   ├── js/
│   │   ├── config.js           # App constants, API URL, status maps
│   │   ├── api.js              # Full API client (all endpoints)
│   │   ├── auth.js             # Auth state, guards, session management
│   │   ├── state.js            # Lightweight reactive state manager
│   │   ├── ui.js               # Toast, modal, loading, helpers
│   │   ├── map.js              # Interactive mall map (10×10 grid)
│   │   └── dashboard.js        # Shared dashboard logic
│   │
│   └── icons/
│       └── logo.jpg            # App logo (place here)
│
└── README.md
```

## Setup

### 1. Place your logo
Put your `logo.jpg` into `assets/icons/logo.jpg`.

### 2. Configure API URL
Open `assets/js/config.js` and verify:
```js
API_URL: 'https://plexi-digital-mall-backend.vercel.app/api'
```

### 3. Serve locally
Any static file server works:

```bash
# Python
python -m http.server 8080

# Node / npx
npx serve .

# VS Code
# Use the "Live Server" extension
```

Then open `http://localhost:8080`.

## Authentication & Role Routing

Login redirects automatically by role:

| Role    | Dashboard              |
|---------|------------------------|
| admin   | `/dashboard/admin.html`   |
| seller  | `/dashboard/seller.html`  |
| shopper | `/dashboard/shopper.html` |

Each dashboard calls `Auth.requireRole('...')` on load — unauthorized users are immediately redirected.

## API Client (`assets/js/api.js`)

All backend endpoints are wrapped under `window.api`:

```js
api.auth.login(email, password)
api.auth.signup(email, password, role)
api.stores.list({ status: 'published' })
api.stores.get(id)
api.products.list(storeId)
api.products.get(id)
api.orders.list()
api.orders.create(data)
api.cart.get()
api.cart.add({ product_id, quantity })
api.cart.update(id, qty)
api.cart.remove(id)
api.wishlist.list()
api.wishlist.add(productId)
api.reviews.list({ store_id })
api.reviews.create(data)
api.notifications.list()
api.notifications.markAll()
api.support.create(data)
api.subscriptions.get()
api.subscriptions.upgrade(plan)
api.admin.stats()
api.admin.approveStore(id)
api.admin.banUser(id, reason)
api.map.stores()
api.map.update(storeId, coords)
```

The client automatically:
- Attaches `Authorization: Bearer <token>` from `localStorage`
- Parses Vercel's wrapped `{ body: ... }` responses
- Redirects to `/login.html` on 401
- Throws clean `Error` objects with `.status` and `.data`

## Design System

### Colors (from `variables.css`)
```
--primary:   #C0392B   (red)
--secondary: #F39C12   (amber)
--bg:        #F0F0F3   (neomorphic base)
--surface:   #FFFFFF
```

### Neomorphic Shadow Classes
```css
.neo          /* raised card */
.neo-inset    /* pressed / input field */
.neo-flat     /* subtle surface */
.neo-card     /* hoverable card with lift */
.btn-neo-primary  /* primary CTA button */
```

### Animation Utilities
```css
.animate-fadeIn
.animate-fadeInUp
.animate-scaleIn
.animate-bounceIn
.animate-float
.hover-lift
.stagger-child   /* + JS: UI.staggerReveal(container) */
```

### UI Helpers (`assets/js/ui.js`)
```js
UI.toast(message, type)          // 'success' | 'error' | 'warning' | 'info'
UI.createModal({ id, title, content, footer })
UI.openModal(id)
UI.closeModal(id)
UI.confirmDialog({ title, message, onConfirm, danger })
UI.setLoading(btnEl, true/false)
UI.formatCurrency(amount)        // → 'R123.45'
UI.formatDate(dateStr)
UI.timeAgo(dateStr)
UI.badge(text, color)
UI.statusBadge(value, configMap)
UI.stars(rating)
UI.skeleton(w, h)
UI.empty(title, message)
UI.staggerReveal(container)
```

## Pages Overview

### `index.html` — Landing Page
- Hero section with animated card stack
- Live store count stats fetched from API
- Interactive 10×10 mall directory map
- Category filter chips (Fashion, Electronics, Food, etc.)
- Paginated store cards grid (12 per page)
- Featured products grid
- Wishlist & cart from landing page (auth-aware)

### `login.html` / `signup.html`
- Split-panel layout (visual left, form right)
- Neomorphic form inputs with show/hide password
- Role selector cards (Shopper / Seller) on signup
- Auto-redirect if already authenticated

### `dashboard/admin.html`
- Platform stats (users, stores, revenue, orders)
- Pending store approvals with one-click Approve/Reject
- Full user table with ban/unban
- Full store table with approve/suspend/reject/feature
- Orders table with status filter
- Support tickets table with reply
- Mall map management view
- Subscriptions overview
- Notifications panel

### `dashboard/seller.html`
- Per-store selector (switch between owned stores)
- Overview: products, orders, revenue, avg rating stats
- Product CRUD (add, edit, delete via modal)
- Orders table with live status update dropdown
- Customer reviews grid
- Store settings form (edit name, description, category, logo, banner)
- Mall placement map (click empty cell to position store)
- Team members table with invite modal
- Subscription & billing with plan upgrade
- Support tickets with reply thread

### `dashboard/shopper.html`
- Shopping stats (orders, total spent, wishlist, cart count)
- Orders table with cancel + detail modal
- Cart page with quantity controls, subtotal, checkout CTA
- Wishlist grid with add-to-cart
- My reviews with delete
- Profile editor (display name)
- Full notifications list
- Support ticket creation + reply thread

### `store/store.html`
- Full-height store banner with logo overlay
- Sticky store info bar (name, category, status, product count)
- Products tab: category chips, sort, search, pagination
- Reviews tab: avg star rating + review cards grid
- About tab: store details panel
- Write a review modal with star picker
- Follow / Unfollow button

### `store/product.html`
- Image gallery with thumbnail switcher
- Variant selector buttons
- Quantity control (with stock cap)
- Add to Cart + Wishlist toggle
- Store mini-card with link
- Description / Reviews / Shipping tabs
- Related products from same store
- Product review modal

## Deployment

Drop the entire folder into any static hosting:

- **Vercel**: `vercel deploy`
- **Netlify**: drag & drop the folder
- **GitHub Pages**: push and enable pages on `main`
- **Firebase Hosting**: `firebase deploy`

No build step required — pure HTML/CSS/JS.

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+.
Requires `fetch`, `localStorage`, `IntersectionObserver`, `AbortSignal.timeout`.