// ============================================================
// PLEXI DIGITAL MALL — Map / Mall Directory
// ============================================================

const MallMap = (() => {
  const GRID_SIZE = 10;
  const SHEET_MAX = 700;
  let stores = [];
  let selectedStore = null;
  let container = null;
  let onSelect = null;
  let onReady = null;
  let placementMode = false;
  let placementStoreId = null;
  let resizeTimer = null;
  let categoryFilter = 'all';
  let peekToken = 0;
  let peekGesture = 0;
  let panBound = false;

  function storePageHref(id) {
    const prefix = /\/(store|dashboard)\//.test(location.pathname) ? '../' : '';
    return `${prefix}store/store.html?id=${id}`;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function reduced() {
    return typeof UI !== 'undefined' && UI.prefersReducedMotion
      ? UI.prefersReducedMotion()
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isSheetPeek() {
    return !placementMode && window.innerWidth < SHEET_MAX;
  }

  function safeImgUrl(u) {
    if (!u || typeof u !== 'string') return '';
    const t = u.trim();
    if (!/^https?:\/\//i.test(t) && !t.startsWith('data:image')) return '';
    return t.replace(/["')]/g, '');
  }

  function hasFloorCoords(s) {
    const x = Number(s?.coordinates?.x);
    const y = Number(s?.coordinates?.y);
    return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0;
  }

  function matchesCategory(store) {
    if (!categoryFilter || categoryFilter === 'all') return true;
    return (store.category || '').toLowerCase() === categoryFilter.toLowerCase();
  }

  function init(containerEl, onSelectCb = null, onReadyCb = null) {
    container = containerEl;
    onSelect = onSelectCb;
    onReady = onReadyCb;
    placementMode = false;
    placementStoreId = null;
    bindResize();
    renderLoading();
    loadStores();
  }

  function bindResize() {
    if (bindResize.done) return;
    bindResize.done = true;
    bindPeekKeys();
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const keep = selectedStore;
        render();
        if (placementMode && placementStoreId) bindPlacementCells();
        if (keep && !placementMode) {
          selectedStore = keep;
          markSelected(keep, { pulse: false });
          showPeek(keep, { fresh: true });
        }
      }, 150);
    });
  }

  async function loadStores() {
    try {
      const data = await api.map.stores();
      stores = Array.isArray(data) ? data : (data.stores || []);
    } catch (err) {
      console.error('Map load error:', err);
    }
    render();
    if (placementMode && placementStoreId) bindPlacementCells();
    if (typeof onReady === 'function') onReady(floorStats());
  }

  function occupiedStores() {
    return stores.filter(hasFloorCoords);
  }

  function storesAt(x, y) {
    return occupiedStores().filter((s) => Number(s.coordinates.x) === x && Number(s.coordinates.y) === y);
  }

  function occupiedInOrder() {
    return occupiedStores().slice().sort((a, b) => {
      const ay = Number(a.coordinates.y);
      const by = Number(b.coordinates.y);
      if (ay !== by) return ay - by;
      const ax = Number(a.coordinates.x);
      const bx = Number(b.coordinates.x);
      if (ax !== bx) return ax - bx;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function floorStats() {
    const placed = occupiedStores();
    let open = 0;
    placed.forEach((s) => {
      if (typeof CONFIG !== 'undefined' && CONFIG.isOpen(s.trading_hours) === true) open += 1;
    });
    return { shops: placed.length, open, total: stores.length };
  }

  function hasPlacedStore(id) {
    const store = stores.find((s) => String(s.id) === String(id));
    return !!(store && hasFloorCoords(store));
  }

  function setCategoryFilter(cat) {
    categoryFilter = (cat || 'all').toLowerCase();
    applyCategoryDim();
  }

  function applyCategoryDim() {
    if (!container) return;
    container.querySelectorAll('.mall-cell.occupied').forEach((cell) => {
      const store = stores.find((s) => String(s.id) === String(cell.dataset.storeId));
      const match = store ? matchesCategory(store) : true;
      cell.classList.toggle('mall-dim', !match);
    });
    container.querySelectorAll('[data-legend-cat]').forEach((el) => {
      const cat = el.getAttribute('data-legend-cat');
      const active = categoryFilter === 'all' || categoryFilter === cat;
      el.style.opacity = active ? '1' : '0.45';
    });
  }

  function viewBounds() {
    if (placementMode) {
      return { minX: 0, minY: 0, cols: GRID_SIZE, rows: GRID_SIZE };
    }
    const placed = occupiedStores();
    if (!placed.length) {
      return { minX: 0, minY: 0, cols: 4, rows: 4 };
    }
    let minX = GRID_SIZE - 1;
    let maxX = 0;
    let minY = GRID_SIZE - 1;
    let maxY = 0;
    placed.forEach((s) => {
      const x = Number(s.coordinates.x);
      const y = Number(s.coordinates.y);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(GRID_SIZE - 1, maxX + 1);
    maxY = Math.min(GRID_SIZE - 1, maxY + 1);
    let cols = maxX - minX + 1;
    let rows = maxY - minY + 1;
    const minDim = 4;
    if (cols < minDim) {
      minX = Math.max(0, minX - Math.floor((minDim - cols) / 2));
      cols = Math.min(GRID_SIZE - minX, minDim);
    }
    if (rows < minDim) {
      minY = Math.max(0, minY - Math.floor((minDim - rows) / 2));
      rows = Math.min(GRID_SIZE - minY, minDim);
    }
    return { minX, minY, cols, rows };
  }

  function cellSizeFor(cols, rows) {
    const iw = container?.clientWidth || 600;
    const availW = Math.max(180, iw - 36);
    const availH = placementMode
      ? Math.min(380, Math.max(200, Math.floor(window.innerHeight * 0.42)))
      : Math.min(480, Math.max(260, Math.floor(window.innerHeight * 0.50)));
    const byW = Math.floor(availW / cols);
    const byH = Math.floor(availH / rows);
    const fitted = Math.max(52, Math.min(byW, byH, 108));
    if (!placementMode && window.innerWidth < SHEET_MAX) return Math.max(fitted, 64);
    return fitted;
  }

  function renderLoading() {
    if (!container) return;
    const b = viewBounds();
    const cellSize = cellSizeFor(b.cols, b.rows);
    let html = `
      <div style="padding:var(--space-sm);" aria-busy="true" aria-label="Loading mall map">
        <div class="mall-grid neo-inset-lg" style="
          display:grid;
          grid-template-columns:repeat(${b.cols},${cellSize}px);
          grid-template-rows:repeat(${b.rows},${cellSize}px);
          width:${cellSize * b.cols}px;
          height:${cellSize * b.rows}px;
          border-radius:var(--radius-lg);
          overflow:hidden;
          gap:2px;
          background:var(--border-light);
        ">
    `;
    for (let i = 0; i < b.cols * b.rows; i++) {
      html += `<div class="skeleton" style="width:100%;height:100%;border-radius:0;"></div>`;
    }
    html += `</div></div>`;
    container.innerHTML = html;
  }

  function getStoreAt(x, y) {
    const here = storesAt(x, y);
    if (!here.length) return null;
    if (selectedStore && here.some((s) => sameId(s.id, selectedStore.id))) return selectedStore;
    return here[0];
  }

  function getCategoryColor(category = '') {
    const colors = {
      fashion: '#E74C3C',
      electronics: '#3498DB',
      food: '#F39C12',
      beauty: '#9B59B6',
      sports: '#27AE60',
      home: '#1ABC9C',
      books: '#E67E22',
      toys: '#F1C40F'
    };
    return colors[category.toLowerCase()] || '#7F8C8D';
  }

  function openBadge(store, compact) {
    if (typeof CONFIG === 'undefined') return '';
    const oc = CONFIG.isOpen(store.trading_hours);
    if (oc === null) return '';
    const bg = oc ? 'rgba(39,174,96,0.95)' : 'rgba(192,57,43,0.92)';
    const label = oc ? 'Open' : 'Closed';
    if (compact) {
      return `<span class="mall-open-dot" title="${label}" style="position:absolute;top:4px;left:4px;width:8px;height:8px;border-radius:50%;background:${bg};border:1px solid #fff;box-shadow:0 0 0 1px ${bg};"></span>`;
    }
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;transition:background 0.2s ease;">● ${label}</span>`;
  }

  function cellInnerHTML(store, cellSize) {
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    const logo = safeImgUrl(store.logo);
    const nameSize = Math.max(8, Math.min(11, Math.floor(cellSize * 0.16)));
    const logoSize = Math.max(22, Math.min(40, Math.floor(cellSize * 0.38)));
    const stack = storesAt(Number(store.coordinates.x), Number(store.coordinates.y)).length;
    return `
      ${openBadge(store, true)}
      ${store.featured ? '<div style="position:absolute;top:3px;right:3px;font-size:9px;line-height:1;">⭐</div>' : ''}
      ${stack > 1 ? `<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.55);color:#fff;font-size:9px;font-weight:700;border-radius:8px;padding:1px 5px;">${stack}</div>` : ''}
      <div style="
        width:${logoSize}px;height:${logoSize}px;border-radius:8px;
        background:${logo ? '#fff' : color};
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:${Math.max(11, Math.floor(logoSize * 0.42))}px;font-weight:700;
        margin-bottom:3px;overflow:hidden;
        box-shadow:0 2px 8px rgba(0,0,0,0.28);
        border:2px solid rgba(255,255,255,0.9);
      ">${logo ? `<img src="${esc(logo)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : esc((store.name || '?').charAt(0).toUpperCase())}</div>
      <div style="font-size:${nameSize}px;font-weight:700;color:#fff;text-align:center;line-height:1.15;overflow:hidden;max-width:100%;text-shadow:0 1px 3px rgba(0,0,0,0.65);padding:0 2px 2px;">
        ${esc(store.name.length > 11 ? store.name.slice(0, 10) + '…' : store.name)}
      </div>`;
  }

  function paintCell(cell, store, selected) {
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    cell.dataset.storeId = store.id;
    cell.title = store.name;
    cell.style.background = banner
      ? `url("${banner}") center/cover no-repeat`
      : `linear-gradient(160deg, ${color}cc, ${color}55)`;
    cell.style.border = selected ? `3px solid ${color}` : `1px solid ${color}55`;
    cell.style.zIndex = selected ? '4' : '1';
    cell.style.transform = selected ? 'scale(1.08)' : '';
    cell.style.boxShadow = selected ? `0 6px 18px ${color}55` : `inset 0 0 0 2px ${color}22`;
    cell.classList.toggle('selected', selected);
    cell.classList.toggle('mall-dim', !matchesCategory(store));
    const size = parseInt(cell.dataset.size, 10) || 64;
    cell.innerHTML = cellInnerHTML(store, size);
  }

  function render() {
    if (!container) return;
    hidePeekImmediate();
    const b = viewBounds();
    const cellSize = cellSizeFor(b.cols, b.rows);
    const totalW = cellSize * b.cols;
    const totalH = cellSize * b.rows;
    const shopCount = occupiedStores().length;

    let html = `
      <div class="mall-map-wrap" style="position:relative;padding:var(--space-sm);">
        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-sm);flex-wrap:wrap;align-items:center;">
          ${legendHTML()}
          <span style="margin-left:auto;font-size:12px;color:var(--text-muted);font-weight:600;">
            ${placementMode ? 'Click an empty unit to place your store' : shopCount ? `${shopCount} shop${shopCount === 1 ? '' : 's'} on this floor` : 'No shops placed yet'}
          </span>
        </div>
        <div class="mall-floor-scroller" id="mall-floor-scroller">
        <div class="mall-grid neo-inset-lg" style="
          display:grid;
          grid-template-columns:repeat(${b.cols},${cellSize}px);
          grid-template-rows:repeat(${b.rows},${cellSize}px);
          width:${totalW}px;
          height:${totalH}px;
          border-radius:var(--radius-lg);
          overflow:visible;
          gap:2px;
          background:var(--border-light);
          margin:0 auto;
        " role="group" aria-label="Mall map grid">
    `;

    for (let y = b.minY; y < b.minY + b.rows; y++) {
      for (let x = b.minX; x < b.minX + b.cols; x++) {
        const store = getStoreAt(x, y);
        const isSelected = !!(store && selectedStore && sameId(selectedStore.id, store.id));
        const color = store ? getCategoryColor(store.category) : null;
        const match = store ? matchesCategory(store) : true;
        const banner = store ? safeImgUrl(store.banner) : '';
        const bg = store
          ? (banner
            ? `url("${banner}") center/cover no-repeat`
            : `linear-gradient(160deg, ${color}cc, ${color}55)`)
          : 'var(--bg)';

        html += `
          <div
            class="mall-cell ${store ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''} ${store && !match ? 'mall-dim' : ''}"
            data-x="${x}" data-y="${y}" ${store ? `data-store-id="${store.id}"` : ''} data-size="${cellSize}"
            style="
              background:${bg};
              border:${isSelected ? `3px solid ${color}` : `1px solid ${store ? color + '55' : 'var(--border-light)'}`};
              display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
              cursor:${store || placementMode ? 'pointer' : 'default'};
              border-radius:4px;
              padding:3px;
              position:relative;
              z-index:${isSelected ? '4' : '1'};
              transform:${isSelected ? 'scale(1.08)' : 'none'};
              ${isSelected ? `box-shadow:0 6px 18px ${color}55;` : store ? `box-shadow: inset 0 0 0 2px ${color}22;` : ''}
            "
            ${store ? `title="${esc(store.name)}"` : ''}
          >
            ${store ? cellInnerHTML(store, cellSize) : `<div style="width:16px;height:1px;background:var(--border);border-radius:1px;margin:auto;"></div>`}
          </div>
        `;
      }
    }

    html += `</div></div></div>`;
    container.innerHTML = html;
    bindFloorPan();
    bindCellHover();
    bindFloorDeselect();
    if (selectedStore && !placementMode) {
      markSelected(selectedStore, { pulse: false });
      showPeek(selectedStore, { fresh: true });
    }
  }

  function bindCellHover() {
    container.querySelectorAll('.mall-cell.occupied').forEach((cell) => {
      cell.addEventListener('mouseenter', () => {
        if (cell.classList.contains('selected')) return;
        cell.style.transform = 'scale(1.06)';
        cell.style.zIndex = '10';
      });
      cell.addEventListener('mouseleave', () => {
        if (cell.classList.contains('selected')) return;
        cell.style.transform = '';
        cell.style.zIndex = '1';
      });
    });
  }

  function bindFloorPan() {
    const scroller = container.querySelector('.mall-floor-scroller');
    if (!scroller) return;
    panBound = true;
    let startX = 0;
    let startY = 0;
    let sl = 0;
    let st = 0;
    let moved = false;
    let active = false;

    const onMove = (e) => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 12) moved = true;
      if (moved) {
        scroller.scrollLeft = sl - dx;
        scroller.scrollTop = st - dy;
      }
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      scroller.classList.remove('is-panning');
      window.removeEventListener('pointermove', onMove);
      if (moved) scroller.dataset.skipClick = '1';
    };

    scroller.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (e.button) return;
      if (e.target.closest('#mall-store-pop')) return;
      active = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      sl = scroller.scrollLeft;
      st = scroller.scrollTop;
      scroller.classList.add('is-panning');
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
    });

    container.querySelectorAll('.mall-cell.occupied').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        if (scroller.dataset.skipClick === '1') {
          scroller.dataset.skipClick = '';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.stopPropagation();
        selectStore(cell.dataset.storeId);
      });
    });
  }

  function legendHTML() {
    const cats = ['Fashion', 'Electronics', 'Food', 'Beauty', 'Sports', 'Home', 'Books', 'Toys'];
    return cats.map((c) => {
      const color = getCategoryColor(c);
      const active = categoryFilter === 'all' || categoryFilter === c.toLowerCase();
      return `<div data-legend-cat="${c.toLowerCase()}" style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);opacity:${active ? '1' : '0.45'};">
        <div style="width:10px;height:10px;border-radius:3px;background:${color};"></div>${c}
      </div>`;
    }).join('');
  }

  function positionPeek(pop, cell, wrap) {
    if (isSheetPeek() || !cell || !wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    let left = cellRect.left - wrapRect.left + cellRect.width + 8;
    let top = cellRect.top - wrapRect.top;
    if (left + popRect.width > wrapRect.width - 8) {
      left = cellRect.left - wrapRect.left - popRect.width - 8;
    }
    if (left < 8) left = 8;
    if (top + popRect.height > wrapRect.height - 8) {
      top = Math.max(8, wrapRect.height - popRect.height - 8);
    }
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function sameId(a, b) {
    return a != null && b != null && String(a) === String(b);
  }

  function peekHTML(store) {
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    const logo = safeImgUrl(store.logo);
    const list = occupiedInOrder();
    const idx = list.findIndex((s) => sameId(s.id, store.id));
    const many = list.length > 1;
    const stack = storesAt(Number(store.coordinates?.x), Number(store.coordinates?.y)).length;
    const place = idx >= 0 ? `${idx + 1} of ${list.length}` : '';
    return `
      ${isSheetPeek() ? '<div class="mall-peek-handle" aria-hidden="true"></div>' : ''}
      <div style="height:56px;background:linear-gradient(135deg,${color},${color}88);position:relative;overflow:hidden;">
        ${banner ? `<img src="${esc(banner)}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0.75">` : ''}
        ${logo ? `<img src="${esc(logo)}" alt="" style="position:absolute;bottom:-14px;left:12px;width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #fff;background:#fff;">` : ''}
      </div>
      <div style="padding:var(--space-md);padding-top:18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:16px;">${esc(store.name)}</div>
          ${openBadge(store, false)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin:4px 0 var(--space-sm);">${esc(store.category || '')}${many ? ` · shop ${esc(place)}${stack > 1 ? ' at this unit' : ''}` : ''}</div>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(store.description || 'Pop in and browse this shop.')}</p>
        <div id="mall-peek-products" style="display:flex;flex-direction:column;gap:8px;margin-bottom:var(--space-md);font-size:12px;color:var(--text-muted);">Loading products…</div>
        <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:center;">
          ${many ? '<button type="button" class="btn btn-ghost btn-sm" data-peek-nav="-1" aria-label="Previous shop">←</button>' : ''}
          <a href="${storePageHref(store.id)}" class="btn btn-primary btn-sm">Visit Store</a>
          <button type="button" class="btn btn-ghost btn-sm" data-peek-close="1">Close</button>
          ${many ? '<button type="button" class="btn btn-ghost btn-sm" data-peek-nav="1" aria-label="Next shop">→</button>' : ''}
        </div>
      </div>`;
  }

  function hidePeekImmediate() {
    peekToken += 1;
    peekGesture += 1;
    document.getElementById('mall-store-pop')?.remove();
    document.getElementById('mall-peek-scrim')?.remove();
    document.body.style.overflow = '';
  }

  function hidePeek(cb) {
    const pop = document.getElementById('mall-store-pop');
    const scrim = document.getElementById('mall-peek-scrim');
    peekToken += 1;
    peekGesture += 1;
    document.body.style.overflow = '';
    if (!pop) {
      if (cb) cb();
      return;
    }
    pop.style.transform = '';
    if (reduced()) {
      pop.remove();
      scrim?.remove();
      if (cb) cb();
      return;
    }
    pop.classList.add('mall-peek-out');
    pop.classList.remove('is-on');
    scrim?.classList.add('mall-peek-scrim-out');
    scrim?.classList.remove('is-on');
    setTimeout(() => {
      pop.remove();
      scrim?.remove();
      if (cb) cb();
    }, 220);
  }

  function showPeek(store, { fresh = false } = {}) {
    const wrap = container.querySelector('.mall-map-wrap');
    const cell = cellForStore(store);
    if (!wrap) return;
    const token = ++peekToken;
    const sheet = isSheetPeek();
    let pop = document.getElementById('mall-store-pop');
    let scrim = document.getElementById('mall-peek-scrim');

    const reuse = pop && pop.isConnected;
    const mount = () => {
      if (!pop) {
        pop = document.createElement('div');
        pop.id = 'mall-store-pop';
        pop.setAttribute('role', 'dialog');
        (sheet ? document.body : wrap).appendChild(pop);
      } else if (sheet && pop.parentElement !== document.body) {
        document.body.appendChild(pop);
      } else if (!sheet && pop.parentElement !== wrap) {
        wrap.appendChild(pop);
      }
      if (sheet && !document.getElementById('mall-peek-scrim')) {
        scrim = document.createElement('div');
        scrim.id = 'mall-peek-scrim';
        scrim.addEventListener('click', () => deselect());
        document.body.appendChild(scrim);
      }
      if (!sheet) document.getElementById('mall-peek-scrim')?.remove();
      pop.classList.remove('mall-peek-out', 'mall-peek-swap');
      pop.classList.toggle('mall-peek', true);
      pop.classList.toggle('mall-peek-sheet', sheet);
      pop.classList.toggle('mall-peek-desktop', !sheet);
      pop.setAttribute('aria-label', store.name);
      pop.innerHTML = peekHTML(store);
      pop.querySelector('[data-peek-close]')?.addEventListener('click', () => deselect());
      pop.querySelectorAll('[data-peek-nav]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectNeighbor(parseInt(btn.getAttribute('data-peek-nav'), 10));
        });
      });
      if (!sheet) positionPeek(pop, cell, wrap);
      const openNow = () => {
        pop.classList.add('is-on');
        document.getElementById('mall-peek-scrim')?.classList.add('is-on');
        if (sheet) document.body.style.overflow = 'hidden';
        if (!sheet) positionPeek(pop, cell, wrap);
      };
      if (reuse && !fresh) openNow();
      else requestAnimationFrame(openNow);
      bindPeekGestures(pop);
      fillPeekProducts(store, pop, cell, wrap, token);
      if (cell) {
        cell.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };

    if (pop && !fresh) {
      if (reduced()) {
        mount();
        return;
      }
      pop.classList.add('mall-peek-swap');
      setTimeout(() => {
        pop.classList.remove('mall-peek-swap', 'mall-peek-out');
        mount();
      }, 120);
      return;
    }
    mount();
  }

  function cellForStore(store) {
    if (!store || !container) return null;
    const x = Number(store.coordinates?.x);
    const y = Number(store.coordinates?.y);
    return container.querySelector(`.mall-cell[data-x="${x}"][data-y="${y}"]`);
  }

  function bindPeekGestures(pop) {
    if (pop._peekAbort) pop._peekAbort.abort();
    const ac = new AbortController();
    pop._peekAbort = ac;
    const opts = { signal: ac.signal };
    let sx = 0;
    let sy = 0;
    let tracking = false;
    const sheet = pop.classList.contains('mall-peek-sheet');

    pop.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target.closest('button, a, input, textarea, select')) return;
      tracking = true;
      sx = e.clientX;
      sy = e.clientY;
      try { pop.setPointerCapture(e.pointerId); } catch (_) {}
    }, opts);
    pop.addEventListener('pointermove', (e) => {
      if (!tracking) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (sheet && dy > 0 && Math.abs(dy) > Math.abs(dx) && pop.scrollTop < 8 && !reduced()) {
        pop.style.transform = `translateY(${dy}px)`;
      }
    }, opts);
    const onUp = (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      pop.style.transform = '';
      if (sheet && dy > 80 && Math.abs(dy) > Math.abs(dx)) {
        deselect();
        return;
      }
      if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy)) {
        selectNeighbor(dx < 0 ? 1 : -1);
      }
    };
    pop.addEventListener('pointerup', onUp, opts);
    pop.addEventListener('pointercancel', onUp, opts);
  }

  async function fillPeekProducts(store, pop, cell, wrap, token) {
    const slot = pop.querySelector('#mall-peek-products');
    if (!slot || typeof api === 'undefined') return;
    try {
      const data = await api.products.list(store.id, { limit: 6 });
      if (token !== peekToken) return;
      const products = (Array.isArray(data) ? data : (data.products || []))
        .filter((p) => !p.sold_out && Number(p.inventory) !== 0)
        .slice(0, 3);
      if (!products.length) {
        slot.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">No products listed yet.</span>';
        positionPeek(pop, cell, wrap);
        return;
      }
      slot.innerHTML = products.map((p, i) => {
        const sale = Number(p.original_price) > Number(p.price);
        const img = safeImgUrl(p.images?.[0]);
        const price = typeof UI !== 'undefined' ? UI.formatCurrency(p.price) : `R${p.price}`;
        const was = sale && typeof UI !== 'undefined' ? UI.formatCurrency(p.original_price) : '';
        return `<div class="mall-peek-row" style="animation-delay:${i * 40}ms">
          <div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${img ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
            ${typeof UI !== 'undefined' && UI.productChoicesHint(p) ? `<div style="font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(UI.productChoicesHint(p))}</div>` : ''}
            <div style="font-size:11px;">
              ${sale ? `<span style="text-decoration:line-through;color:var(--text-muted);margin-right:4px;">${esc(was)}</span>` : ''}
              <span style="font-weight:700;color:var(--text-primary);">${esc(typeof UI !== 'undefined' && UI.productPriceLabel ? UI.productPriceLabel(p) : price)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();UI.addToCartModal('${esc(p.id)}',{fromEl:this})" ${p.inventory === 0 || p.sold_out ? 'disabled' : ''}>${typeof UI !== 'undefined' && UI.hasProductChoices(p) ? 'Choose' : 'Add'}</button>
        </div>`;
      }).join('');
      if (reduced()) {
        slot.querySelectorAll('.mall-peek-row').forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; el.style.animation = 'none'; });
      }
      positionPeek(pop, cell, wrap);
    } catch (_) {
      if (token !== peekToken) return;
      slot.innerHTML = '';
      positionPeek(pop, cell, wrap);
    }
  }

  function markSelected(store, { pulse = true } = {}) {
    if (!container) return;
    container.querySelectorAll('.mall-cell.occupied').forEach((cell) => {
      const x = parseInt(cell.dataset.x, 10);
      const y = parseInt(cell.dataset.y, 10);
      const shown = getStoreAt(x, y);
      if (!shown) return;
      const on = store && sameId(shown.id, store.id);
      paintCell(cell, shown, !!on);
      cell.classList.remove('mall-pulse');
      if (on && pulse && !reduced()) {
        void cell.offsetWidth;
        cell.classList.add('mall-pulse');
        setTimeout(() => cell.classList.remove('mall-pulse'), 400);
      }
    });
  }

  function bindFloorDeselect() {
    const scroller = container.querySelector('.mall-floor-scroller');
    if (!scroller) return;
    scroller.addEventListener('click', (e) => {
      if (placementMode || !selectedStore) return;
      if (e.target.closest('.mall-cell.occupied, #mall-store-pop')) return;
      deselect();
    });
  }

  function bindPeekKeys() {
    if (bindPeekKeys.done) return;
    bindPeekKeys.done = true;
    document.addEventListener('keydown', (e) => {
      if (placementMode || !selectedStore) return;
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'Escape') {
        deselect();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectNeighbor(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectNeighbor(1);
      }
    });
  }

  function selectNeighbor(dir) {
    const list = occupiedInOrder();
    if (list.length < 2) return;
    const i = list.findIndex((s) => sameId(s.id, selectedStore?.id));
    if (i < 0) return;
    const next = list[(i + dir + list.length) % list.length];
    if (next) selectStore(next.id, { toggle: false });
  }

  function selectStore(id, { toggle = true } = {}) {
    if (toggle && sameId(selectedStore?.id, id)) {
      deselect();
      return;
    }
    const store = stores.find((s) => sameId(s.id, id));
    if (!store) {
      window.location.href = storePageHref(id);
      return;
    }
    if (!placementMode && !hasFloorCoords(store)) {
      window.location.href = storePageHref(id);
      return;
    }
    const switching = !!(selectedStore && !sameId(selectedStore.id, store.id));
    selectedStore = store;
    markSelected(store, { pulse: true });
    if (!placementMode) showPeek(store, { fresh: !switching });
    if (onSelect) onSelect(selectedStore);
  }

  function deselect() {
    hidePeek(() => {
      selectedStore = null;
      if (!container) return;
      container.querySelectorAll('.mall-cell.occupied').forEach((cell) => {
        const x = parseInt(cell.dataset.x, 10);
        const y = parseInt(cell.dataset.y, 10);
        const shown = getStoreAt(x, y);
        if (shown) paintCell(cell, shown, false);
      });
    });
  }

  function bindPlacementCells() {
    if (!container || !placementStoreId) return;
    const cells = container.querySelectorAll('.mall-cell.empty');
    cells.forEach((cell) => {
      cell.style.cursor = 'pointer';
      cell.style.border = '1.5px dashed var(--border)';
      cell.addEventListener('mouseenter', () => {
        cell.style.background = 'var(--primary-alpha)';
        cell.style.border = '1.5px dashed var(--primary)';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.background = '';
        cell.style.border = '1.5px dashed var(--border)';
      });
      cell.addEventListener('click', async () => {
        const x = parseInt(cell.dataset.x, 10);
        const y = parseInt(cell.dataset.y, 10);
        try {
          await api.map.update(placementStoreId, { x, y });
          UI.toast('Store position updated!', 'success');
          await loadStores();
        } catch (err) {
          UI.toast(err.message || 'Failed to update position', 'error');
        }
      });
    });
  }

  function initPlacement(storeId) {
    placementMode = true;
    placementStoreId = storeId;
    selectedStore = null;
    hidePeekImmediate();
    render();
    bindPlacementCells();
  }

  return {
    init,
    loadStores,
    selectStore,
    deselect,
    selectNeighbor,
    initPlacement,
    render,
    setCategoryFilter,
    hasPlacedStore,
    floorStats
  };
})();

window.MallMap = MallMap;
