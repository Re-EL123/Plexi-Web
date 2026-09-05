// ============================================================
// PLEXI DIGITAL MALL — Map / Mall Directory & Floor Plan
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
  let searchQuery = '';
  let viewMode = 'grid'; // 'grid' | 'directory'
  let zoomLevel = 1;     // 0.85, 1, 1.25
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

  function unitCode(x, y) {
    const rowChar = String.fromCharCode(65 + Math.max(0, Math.min(25, y)));
    return `Unit ${rowChar}${x + 1}`;
  }

  function matchesCategory(store) {
    if (!categoryFilter || categoryFilter === 'all') return true;
    return (store.category || '').toLowerCase() === categoryFilter.toLowerCase();
  }

  function matchesSearch(store) {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = String(store.name || '').toLowerCase();
    const cat = String(store.category || '').toLowerCase();
    const desc = String(store.description || '').toLowerCase();
    const tags = Array.isArray(store.tags) ? store.tags.join(' ').toLowerCase() : '';
    const code = hasFloorCoords(store) ? unitCode(Number(store.coordinates.x), Number(store.coordinates.y)).toLowerCase() : '';
    return name.includes(q) || cat.includes(q) || desc.includes(q) || tags.includes(q) || code.includes(q);
  }

  function matchesStore(store) {
    return matchesCategory(store) && matchesSearch(store);
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
        if (keep && !placementMode && viewMode === 'grid') {
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

  function filteredOccupiedStores() {
    return occupiedStores().filter(matchesStore);
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
    return { shops: placed.length, open, total: stores.length, capacity: GRID_SIZE * GRID_SIZE };
  }

  function hasPlacedStore(id) {
    const store = stores.find((s) => String(s.id) === String(id));
    return !!(store && hasFloorCoords(store));
  }

  function setCategoryFilter(cat) {
    const normalized = (cat || 'all').toLowerCase();
    if (categoryFilter === normalized && normalized !== 'all') {
      categoryFilter = 'all';
    } else {
      categoryFilter = normalized;
    }
    render();
    if (selectedStore && !matchesStore(selectedStore)) {
      deselect();
    }
    const chip = document.querySelector(`.cat-scroll .chip[data-category="${categoryFilter}"]`);
    if (chip && !chip.classList.contains('active')) {
      document.querySelectorAll('.cat-scroll .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      if (typeof moveChipSlider === 'function') moveChipSlider(chip);
    }
  }

  function setSearchQuery(q) {
    searchQuery = String(q || '').trim();
    render();
  }

  function resetFilters() {
    categoryFilter = 'all';
    searchQuery = '';
    render();
  }

  function setViewMode(mode) {
    viewMode = mode === 'directory' ? 'directory' : 'grid';
    hidePeekImmediate();
    render();
  }

  function zoom(delta) {
    const levels = [0.8, 1, 1.25, 1.5];
    let idx = levels.indexOf(zoomLevel);
    if (idx === -1) idx = 1;
    const nextIdx = Math.max(0, Math.min(levels.length - 1, idx + delta));
    zoomLevel = levels[nextIdx];
    render();
  }

  function resetZoom() {
    zoomLevel = 1;
    render();
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
    const base = (!placementMode && window.innerWidth < SHEET_MAX) ? Math.max(fitted, 64) : fitted;
    return Math.max(48, Math.round(base * zoomLevel));
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
      return `<span class="mall-open-dot" title="${label}" style="position:absolute;top:4px;left:4px;width:8px;height:8px;border-radius:50%;background:${bg};border:1px solid #fff;box-shadow:0 0 0 1px ${bg};z-index:2;"></span>`;
    }
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;transition:background 0.2s ease;">● ${label}</span>`;
  }

  function cellInnerHTML(store, cellSize, x, y) {
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    const logo = safeImgUrl(store.logo);
    const nameSize = Math.max(8, Math.min(11, Math.floor(cellSize * 0.16)));
    const logoSize = Math.max(22, Math.min(40, Math.floor(cellSize * 0.38)));
    const stack = storesAt(x, y).length;
    const isOpen = typeof CONFIG !== 'undefined' && CONFIG.isOpen(store.trading_hours) === true;
    const code = unitCode(x, y);

    return `
      ${openBadge(store, true)}
      <span class="mall-unit-badge" title="${code}">${code.replace('Unit ', '')}</span>
      ${store.featured ? '<span class="mall-deal-badge" title="Featured Store">⭐</span>' : ''}
      ${stack > 1 ? `<div class="mall-stack-badge" title="${stack} shops at this unit">🏬 ${stack}</div>` : ''}
      <div style="
        width:${logoSize}px;height:${logoSize}px;border-radius:8px;
        background:${logo ? '#fff' : color};
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:${Math.max(11, Math.floor(logoSize * 0.42))}px;font-weight:700;
        margin-bottom:3px;overflow:hidden;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        border:2px solid rgba(255,255,255,0.92);
        z-index:1;
      ">${logo ? `<img src="${esc(logo)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : esc((store.name || '?').charAt(0).toUpperCase())}</div>
      <div style="font-size:${nameSize}px;font-weight:700;color:#fff;text-align:center;line-height:1.15;overflow:hidden;max-width:100%;text-shadow:0 1px 3px rgba(0,0,0,0.85);padding:0 2px 2px;z-index:1;">
        ${esc(store.name.length > 12 ? store.name.slice(0, 11) + '…' : store.name)}
      </div>`;
  }

  function paintCell(cell, store, selected) {
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    const x = parseInt(cell.dataset.x, 10);
    const y = parseInt(cell.dataset.y, 10);
    cell.dataset.storeId = store.id;
    cell.title = `${store.name} (${unitCode(x, y)})`;
    cell.style.background = banner
      ? `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.76) 100%), url('${banner.replace(/'/g, "\\'")}') center/cover no-repeat`
      : `linear-gradient(160deg, ${color}dd, ${color}66)`;
    cell.style.border = selected ? `3px solid ${color}` : `1px solid ${color}55`;
    cell.style.zIndex = selected ? '4' : '1';
    cell.style.transform = selected ? 'scale(1.08)' : '';
    cell.style.boxShadow = selected ? `0 6px 18px ${color}55` : `inset 0 0 0 2px ${color}22`;
    cell.classList.toggle('selected', selected);
    cell.classList.toggle('mall-dim', !matchesStore(store));
    const size = parseInt(cell.dataset.size, 10) || 64;
    cell.innerHTML = cellInnerHTML(store, size, x, y);
  }

  function toolbarHTML() {
    const stats = floorStats();
    const placed = occupiedStores();
    const filtered = filteredOccupiedStores();
    const statusText = placementMode
      ? 'Click an empty unit to place your store'
      : (searchQuery || categoryFilter !== 'all')
        ? `${filtered.length} of ${placed.length} shops match`
        : `${stats.shops} shops placed · ${stats.open} open now`;

    return `
      <div class="mall-map-header">
        <div class="mall-map-title-row">
          <div style="font-weight:700;font-size:14px;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
            <span>🏬</span>
            <span>${placementMode ? 'Unit Placement' : 'Mall Floor &amp; Directory'}</span>
          </div>
          <span style="font-size:12px;color:var(--text-muted);font-weight:600;">
            ${statusText}
          </span>
        </div>
        ${!placementMode ? `
        <div class="mall-map-actions">
          <div class="mall-search-box">
            <input type="text" id="mall-dir-search" placeholder="Search shops..." value="${esc(searchQuery)}">
            ${searchQuery ? `<button type="button" class="clear-btn" id="mall-dir-search-clear">✕</button>` : ''}
          </div>
          <div class="mall-view-toggle">
            <button type="button" class="mall-view-btn ${viewMode === 'grid' ? 'active' : ''}" data-view="grid" title="Floor Plan View">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              <span>Plan</span>
            </button>
            <button type="button" class="mall-view-btn ${viewMode === 'directory' ? 'active' : ''}" data-view="directory" title="Directory List View">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              <span>Directory (${filtered.length})</span>
            </button>
          </div>
          ${viewMode === 'grid' ? `
          <div class="mall-zoom-controls">
            <button type="button" class="mall-zoom-btn" id="mall-zoom-out" title="Zoom Out">−</button>
            <button type="button" class="mall-zoom-btn" id="mall-zoom-fit" title="Reset Zoom">Fit</button>
            <button type="button" class="mall-zoom-btn" id="mall-zoom-in" title="Zoom In">+</button>
          </div>` : ''}
        </div>` : ''}
      </div>
    `;
  }

  function legendHTML() {
    const cats = ['Fashion', 'Electronics', 'Food', 'Beauty', 'Sports', 'Home', 'Books', 'Toys'];
    const placed = occupiedStores();
    const totalCount = placed.length;
    const catCounts = {};
    cats.forEach((c) => {
      catCounts[c.toLowerCase()] = placed.filter((s) => (s.category || '').toLowerCase() === c.toLowerCase()).length;
    });

    return `
      <div class="mall-legend-bar">
        <button type="button" class="mall-legend-pill ${categoryFilter === 'all' ? 'active' : ''}" data-legend-cat="all">
          <span>All</span>
          <span class="mall-legend-count">${totalCount}</span>
        </button>
        ${cats.map((c) => {
          const color = getCategoryColor(c);
          const count = catCounts[c.toLowerCase()] || 0;
          const active = categoryFilter === c.toLowerCase();
          return `
            <button type="button" class="mall-legend-pill ${active ? 'active' : ''}" data-legend-cat="${c.toLowerCase()}">
              <span class="mall-legend-dot" style="background:${color};"></span>
              <span>${c}</span>
              <span class="mall-legend-count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderDirectory() {
    const filtered = filteredOccupiedStores();
    let content = '';

    if (!filtered.length) {
      content = `
        <div style="text-align:center;padding:var(--space-xl);color:var(--text-muted);">
          <div style="font-size:36px;margin-bottom:8px;">🔍</div>
          <div style="font-weight:700;font-size:15px;color:var(--text-primary);margin-bottom:4px;">No stores found</div>
          <p style="font-size:13px;margin-bottom:var(--space-md);">No stores on this floor match your current filter or search criteria.</p>
          <button type="button" class="btn btn-ghost btn-sm" onclick="MallMap.resetFilters()">Clear Filters</button>
        </div>
      `;
    } else {
      content = `
        <div class="mall-directory-grid">
          ${filtered.map((s) => {
            const color = getCategoryColor(s.category);
            const banner = safeImgUrl(s.banner);
            const logo = safeImgUrl(s.logo);
            const code = unitCode(Number(s.coordinates?.x), Number(s.coordinates?.y));
            return `
              <div class="mall-directory-card">
                <div class="mall-dir-banner" style="background:${banner ? `linear-gradient(to bottom, rgba(0,0,0,0.15), rgba(0,0,0,0.7)), url('${banner.replace(/'/g, "\\'")}') center/cover no-repeat` : `linear-gradient(135deg, ${color}, ${color}88)`};">
                  <span class="mall-unit-badge" style="top:6px;left:6px;">${code}</span>
                  <div style="position:absolute;top:6px;right:6px;">${openBadge(s, false)}</div>
                  ${logo ? `<img src="${esc(logo)}" alt="" class="mall-dir-logo">` : `<div class="mall-dir-logo" style="display:flex;align-items:center;justify-content:center;font-weight:700;color:${color};font-size:18px;">${esc((s.name || '?').charAt(0).toUpperCase())}</div>`}
                </div>
                <div class="mall-dir-body">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <strong style="font-size:14px;color:var(--text-primary);font-family:var(--font-display);">${esc(s.name)}</strong>
                    <span class="badge badge-primary" style="font-size:10px;background:${color}22;color:${color};border:1px solid ${color}44;">${esc(s.category || '')}</span>
                  </div>
                  <p style="font-size:12px;color:var(--text-secondary);margin:6px 0 10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;">
                    ${esc(s.description || 'Visit this shopfront to discover featured products and order online.')}
                  </p>
                  <div class="mall-dir-actions">
                    <button type="button" class="btn btn-ghost btn-sm" style="flex:1;" data-peek-dir="${s.id}">
                      🔍 Peek on Map
                    </button>
                    <a href="${storePageHref(s.id)}" class="btn btn-primary btn-sm" style="flex:1;">
                      Visit Store
                    </a>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let html = `
      <div class="mall-map-wrap" style="position:relative;padding:var(--space-sm);">
        ${toolbarHTML()}
        ${legendHTML()}
        ${content}
      </div>
    `;
    container.innerHTML = html;
    bindToolbarEvents();
  }

  function render() {
    if (!container) return;
    hidePeekImmediate();

    if (viewMode === 'directory' && !placementMode) {
      renderDirectory();
      return;
    }

    const b = viewBounds();
    const cellSize = cellSizeFor(b.cols, b.rows);
    const totalW = cellSize * b.cols;
    const totalH = cellSize * b.rows;

    let html = `
      <div class="mall-map-wrap" style="position:relative;padding:var(--space-sm);">
        ${toolbarHTML()}
        ${legendHTML()}
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
        const match = store ? matchesStore(store) : true;
        const banner = store ? safeImgUrl(store.banner) : '';
        const code = unitCode(x, y);
        const bg = store
          ? (banner
            ? `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.76) 100%), url('${banner.replace(/'/g, "\\'")}') center/cover no-repeat`
            : `linear-gradient(160deg, ${color}dd, ${color}66)`)
          : 'var(--bg)';

        html += `
          <div
            class="mall-cell ${store ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''} ${store && !match ? 'mall-dim' : ''}"
            data-x="${x}" data-y="${y}" ${store ? `data-store-id="${store.id}"` : ''} data-size="${cellSize}"
            style="
              background:${bg};
              border:${isSelected ? `3px solid ${color}` : `1px solid ${store ? color + '55' : 'var(--border-light)'}`};
              display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
              cursor:${store || placementMode ? 'pointer' : 'pointer'};
              border-radius:4px;
              padding:3px;
              position:relative;
              z-index:${isSelected ? '4' : '1'};
              transform:${isSelected ? 'scale(1.08)' : 'none'};
              ${isSelected ? `box-shadow:0 6px 18px ${color}55;` : store ? `box-shadow: inset 0 0 0 2px ${color}22;` : ''}
            "
            title="${store ? esc(store.name) + ' (' + code + ')' : code + ' · Click to lease unit'}"
          >
            ${store ? cellInnerHTML(store, cellSize, x, y) : `
              <div style="position:absolute;top:4px;left:6px;font-size:10px;font-weight:800;color:var(--text-secondary);opacity:0.75;letter-spacing:0.5px;">${code.replace('Unit ', '')}</div>
              <div class="mall-empty-hint" style="font-size:16px;color:var(--text-muted);opacity:0.45;transition:all 0.18s ease;margin:auto;">＋</div>
              <div style="position:absolute;bottom:4px;left:0;right:0;text-align:center;font-size:9px;font-weight:600;color:var(--text-muted);opacity:0.7;">Available</div>
            `}
          </div>
        `;
      }
    }

    html += `</div></div></div>`;
    container.innerHTML = html;
    bindFloorPan();
    bindCellHover();
    bindFloorDeselect();
    bindToolbarEvents();
    if (selectedStore && !placementMode) {
      markSelected(selectedStore, { pulse: false });
      showPeek(selectedStore, { fresh: true });
    }
  }

  function bindToolbarEvents() {
    // Category legend chips
    container.querySelectorAll('.mall-legend-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const cat = pill.getAttribute('data-legend-cat');
        setCategoryFilter(cat);
      });
    });

    // View switcher buttons
    container.querySelectorAll('.mall-view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        setViewMode(btn.dataset.view);
      });
    });

    // Search input
    const searchInp = container.querySelector('#mall-dir-search');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        clearTimeout(searchInp._timer);
        searchInp._timer = setTimeout(() => {
          render();
          const nextInp = container.querySelector('#mall-dir-search');
          if (nextInp) {
            nextInp.focus();
            nextInp.selectionStart = nextInp.selectionEnd = nextInp.value.length;
          }
        }, 220);
      });
    }
    const clearBtn = container.querySelector('#mall-dir-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchQuery = '';
        render();
      });
    }

    // Zoom buttons
    container.querySelector('#mall-zoom-out')?.addEventListener('click', () => zoom(-1));
    container.querySelector('#mall-zoom-in')?.addEventListener('click', () => zoom(1));
    container.querySelector('#mall-zoom-fit')?.addEventListener('click', () => resetZoom());

    // Directory peek buttons
    container.querySelectorAll('[data-peek-dir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-peek-dir');
        viewMode = 'grid';
        render();
        setTimeout(() => selectStore(id, { toggle: false }), 60);
      });
    });
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

  function openLeaseModal(x, y) {
    const code = unitCode(x, y);
    const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
    const isSeller = user && (user.role === 'seller' || user.role === 'admin');

    if (typeof UI !== 'undefined' && UI.createModal) {
      UI.createModal({
        id: 'mall-lease-modal',
        title: `🏪 ${code} — Available Storefront`,
        content: `
          <div style="text-align:center;padding:var(--space-sm) 0;">
            <div style="width:58px;height:58px;border-radius:14px;background:var(--primary-alpha);color:var(--primary);font-size:26px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;box-shadow:var(--neo-shadow-sm);">🏬</div>
            <h3 style="font-family:var(--font-display);font-size:18px;margin-bottom:6px;color:var(--text-primary);">Prime Spot in South Africa's Virtual Mall</h3>
            <p style="color:var(--text-secondary);font-size:13px;max-width:380px;margin:0 auto var(--space-md);line-height:1.5;">
              Position your store directly on the digital floor map where shoppers explore, peek into shopfronts, and buy online.
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left;font-size:12px;margin-bottom:var(--space-md);">
              <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light);">
                <div style="color:var(--text-muted);font-size:11px;">Unit Location</div>
                <strong style="color:var(--primary);font-size:13px;">${code} (Row ${String.fromCharCode(65 + y)}, Lot ${x + 1})</strong>
              </div>
              <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light);">
                <div style="color:var(--text-muted);font-size:11px;">Foot Traffic</div>
                <strong style="color:var(--success);font-size:13px;">24/7 Digital Shoppers</strong>
              </div>
              <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light);">
                <div style="color:var(--text-muted);font-size:11px;">Payments</div>
                <strong>Integrated Yoco Gateway</strong>
              </div>
              <div style="padding:10px;background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border-light);">
                <div style="color:var(--text-muted);font-size:11px;">Delivery</div>
                <strong>Local Driver Fleet</strong>
              </div>
            </div>
          </div>
        `,
        footer: `
          <button class="btn btn-ghost" onclick="UI.closeModal('mall-lease-modal')">Close</button>
          ${isSeller
            ? `<a href="dashboard/seller.html#section-map" class="btn btn-primary" onclick="UI.closeModal('mall-lease-modal')">Manage Unit in Seller Dashboard</a>`
            : `<a href="signup.html?role=seller" class="btn btn-primary" onclick="UI.closeModal('mall-lease-modal')">Open Your Store in ${code} — Free</a>`
          }
        `
      });
    }
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

    // Empty cell click
    if (!placementMode) {
      container.querySelectorAll('.mall-cell.empty').forEach((cell) => {
        cell.addEventListener('click', (e) => {
          if (scroller.dataset.skipClick === '1') {
            scroller.dataset.skipClick = '';
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          const x = parseInt(cell.dataset.x, 10);
          const y = parseInt(cell.dataset.y, 10);
          openLeaseModal(x, y);
        });
      });
    }
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
    const sx = Number(store.coordinates?.x);
    const sy = Number(store.coordinates?.y);
    const here = storesAt(sx, sy);
    const stack = here.length;
    const code = unitCode(sx, sy);
    const place = idx >= 0 ? `${idx + 1} of ${list.length}` : '';

    return `
      ${isSheetPeek() ? '<div class="mall-peek-handle" aria-hidden="true"></div>' : ''}
      <div style="height:62px;background:linear-gradient(135deg,${color},${color}88);position:relative;overflow:hidden;">
        ${banner ? `<img src="${esc(banner)}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0.75">` : ''}
        ${logo ? `<img src="${esc(logo)}" alt="" style="position:absolute;bottom:-14px;left:12px;width:38px;height:38px;border-radius:8px;object-fit:cover;border:2px solid #fff;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.2);">` : ''}
        <span class="mall-unit-badge" style="top:6px;right:6px;">${code}</span>
      </div>
      <div style="padding:var(--space-md);padding-top:18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:16px;">${esc(store.name)}</div>
          ${openBadge(store, false)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin:4px 0 var(--space-sm);">
          ${esc(store.category || '')} · ${code}${many ? ` · ${esc(place)} on floor` : ''}
        </div>

        ${stack > 1 ? `
          <div class="mall-unit-shops-bar">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
              <span>🏬 ${stack} shops located at ${code}</span>
              <span style="font-size:10px;color:var(--primary);font-weight:600;">Switch shop ⤵</span>
            </div>
            <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;">
              ${here.map((s) => `
                <button type="button" class="btn btn-sm ${sameId(s.id, store.id) ? 'btn-primary' : 'btn-ghost'}"
                  style="padding:3px 8px;font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:4px;"
                  data-switch-store="${s.id}">
                  <span style="width:6px;height:6px;border-radius:50%;background:${getCategoryColor(s.category)};"></span>
                  <span>${esc(s.name)}</span>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;">${esc(store.description || 'Pop in and browse this shopfront for products, deals, and quick delivery.')}</p>
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
      pop.querySelectorAll('[data-switch-store]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectStore(btn.getAttribute('data-switch-store'), { toggle: false });
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
      const products = Array.isArray(data) ? data : (data.products || []);
      if (!products.length) {
        slot.innerHTML = '<div style="font-size:12px;color:var(--text-muted);font-style:italic;">No products listed yet.</div>';
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
      if (e.target.closest('.mall-cell.occupied, #mall-store-pop, .mall-map-header, .mall-legend-bar')) return;
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
    if (viewMode === 'directory') {
      viewMode = 'grid';
      render();
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
    setSearchQuery,
    resetFilters,
    setViewMode,
    zoom,
    resetZoom,
    hasPlacedStore,
    floorStats
  };
})();

window.MallMap = MallMap;
