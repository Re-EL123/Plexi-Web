// ============================================================
// PLEXI DIGITAL MALL — Map / Mall Directory
// ============================================================

const MallMap = (() => {
  const GRID_SIZE = 10; // full floor for seller/admin placement
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
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        render();
        if (placementMode && placementStoreId) bindPlacementCells();
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
    return Math.max(52, Math.min(byW, byH, 108));
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
    return stores.find((s) => {
      const cx = s.coordinates?.x ?? -1;
      const cy = s.coordinates?.y ?? -1;
      return Number(cx) === x && Number(cy) === y;
    });
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
    const key = category.toLowerCase();
    return colors[key] || '#7F8C8D';
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
    return `<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:#fff;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;">● ${label}</span>`;
  }

  function render() {
    if (!container) return;
    const b = viewBounds();
    const cellSize = cellSizeFor(b.cols, b.rows);
    const totalW = cellSize * b.cols;
    const totalH = cellSize * b.rows;
    const shopCount = occupiedStores().length;
    const nameSize = Math.max(8, Math.min(11, Math.floor(cellSize * 0.16)));
    const logoSize = Math.max(22, Math.min(40, Math.floor(cellSize * 0.38)));

    let html = `
      <div class="mall-map-wrap" style="position:relative;padding:var(--space-sm);">
        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-sm);flex-wrap:wrap;align-items:center;">
          ${legendHTML()}
          <span style="margin-left:auto;font-size:12px;color:var(--text-muted);font-weight:600;">
            ${placementMode ? 'Click an empty unit to place your store' : shopCount ? `${shopCount} shop${shopCount === 1 ? '' : 's'} on this floor` : 'No shops placed yet'}
          </span>
        </div>
        <div class="mall-grid neo-inset-lg" style="
          display:grid;
          grid-template-columns:repeat(${b.cols},${cellSize}px);
          grid-template-rows:repeat(${b.rows},${cellSize}px);
          width:${totalW}px;
          max-width:100%;
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
        const isSelected = selectedStore?.id === store?.id;
        const color = store ? getCategoryColor(store.category) : null;
        const match = store ? matchesCategory(store) : true;
        const banner = store ? safeImgUrl(store.banner) : '';
        const logo = store ? safeImgUrl(store.logo) : '';
        const bg = store
          ? (banner
            ? `url("${banner}") center/cover no-repeat`
            : `linear-gradient(160deg, ${color}cc, ${color}55)`)
          : 'var(--bg)';

        html += `
          <div
            class="mall-cell ${store ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''} ${store && !match ? 'mall-dim' : ''}"
            data-x="${x}" data-y="${y}"
            style="
              background:${bg};
              border:${isSelected ? `3px solid ${color}` : `1px solid ${store ? color + '55' : 'var(--border-light)'}`};
              display:flex;flex-direction:column;align-items:center;justify-content:flex-end;
              cursor:${store ? 'pointer' : 'default'};
              transition:transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
              border-radius:4px;
              padding:3px;
              position:relative;
              z-index:${isSelected ? '4' : '1'};
              transform:${isSelected ? 'scale(1.08)' : 'none'};
              opacity:${store && !match ? '0.34' : '1'};
              filter:${store && !match ? 'grayscale(0.55)' : 'none'};
              ${isSelected ? `box-shadow:0 6px 18px ${color}55;` : store ? `box-shadow: inset 0 0 0 2px ${color}22;` : ''}
            "
            ${store ? `onclick="MallMap.selectStore('${store.id}')" title="${esc(store.name)}"` : ''}
          >
            ${store ? `
              ${openBadge(store, true)}
              ${store.featured ? '<div style="position:absolute;top:3px;right:3px;font-size:9px;line-height:1;">⭐</div>' : ''}
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
              </div>
            ` : `
              <div style="width:16px;height:1px;background:var(--border);border-radius:1px;margin:auto;"></div>
            `}
          </div>
        `;
      }
    }

    html += `</div></div>`;
    container.innerHTML = html;

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

    if (selectedStore && !placementMode) placePeek(selectedStore);
  }

  function legendHTML() {
    const cats = ['Fashion', 'Electronics', 'Food', 'Beauty', 'Sports', 'Home', 'Books', 'Toys'];
    return cats.map((c) => {
      const color = getCategoryColor(c);
      const active = categoryFilter === 'all' || categoryFilter === c.toLowerCase();
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);opacity:${active ? '1' : '0.45'};">
        <div style="width:10px;height:10px;border-radius:3px;background:${color};"></div>${c}
      </div>`;
    }).join('');
  }

  function positionPeek(pop, cell, wrap) {
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

  function placePeek(store) {
    const wrap = container.querySelector('.mall-map-wrap');
    const cell = container.querySelector('.mall-cell.selected');
    if (!wrap || !cell) return;
    const token = ++peekToken;
    const color = getCategoryColor(store.category);
    const banner = safeImgUrl(store.banner);
    const logo = safeImgUrl(store.logo);
    const pop = document.createElement('div');
    pop.id = 'mall-store-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', store.name);
    pop.style.cssText = 'position:absolute;z-index:20;width:min(300px,calc(100% - 16px));background:var(--surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);box-shadow:0 12px 32px rgba(0,0,0,0.18);overflow:hidden;';
    pop.innerHTML = `
      <div style="height:56px;background:linear-gradient(135deg,${color},${color}88);position:relative;overflow:hidden;">
        ${banner ? `<img src="${esc(banner)}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0.75">` : ''}
        ${logo ? `<img src="${esc(logo)}" alt="" style="position:absolute;bottom:-14px;left:12px;width:36px;height:36px;border-radius:8px;object-fit:cover;border:2px solid #fff;background:#fff;">` : ''}
      </div>
      <div style="padding:var(--space-md);padding-top:18px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:16px;">${esc(store.name)}</div>
          ${openBadge(store, false)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin:4px 0 var(--space-sm);">${esc(store.category || '')}</div>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(store.description || 'Pop in and browse this shop.')}</p>
        <div id="mall-peek-products" style="display:flex;flex-direction:column;gap:8px;margin-bottom:var(--space-md);font-size:12px;color:var(--text-muted);">Loading products…</div>
        <div style="display:flex;gap:var(--space-sm);">
          <a href="${storePageHref(store.id)}" class="btn btn-primary btn-sm">Visit Store</a>
          <button type="button" class="btn btn-ghost btn-sm" onclick="MallMap.deselect()">Close</button>
        </div>
      </div>`;
    wrap.appendChild(pop);
    positionPeek(pop, cell, wrap);
    requestAnimationFrame(() => {
      pop.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
    fillPeekProducts(store, pop, cell, wrap, token);
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
      slot.innerHTML = products.map((p) => {
        const sale = Number(p.original_price) > Number(p.price);
        const img = safeImgUrl(p.images?.[0]);
        const price = typeof UI !== 'undefined' ? UI.formatCurrency(p.price) : `R${p.price}`;
        const was = sale && typeof UI !== 'undefined' ? UI.formatCurrency(p.original_price) : '';
        return `<div style="display:flex;align-items:center;gap:8px;">
          <div style="width:40px;height:40px;border-radius:6px;overflow:hidden;background:var(--bg);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${img ? `<img src="${esc(img)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : '📦'}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
            <div style="font-size:11px;">
              ${sale ? `<span style="text-decoration:line-through;color:var(--text-muted);margin-right:4px;">${esc(was)}</span>` : ''}
              <span style="font-weight:700;color:var(--text-primary);">${esc(price)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="padding:4px 8px;font-size:11px;" onclick="event.stopPropagation();UI.addToCartModal('${esc(p.id)}')" ${p.inventory === 0 || p.sold_out ? 'disabled' : ''}>Add</button>
        </div>`;
      }).join('');
      positionPeek(pop, cell, wrap);
    } catch (_) {
      if (token !== peekToken) return;
      slot.innerHTML = '';
      positionPeek(pop, cell, wrap);
    }
  }

  function selectStore(id) {
    if (selectedStore?.id === id) {
      deselect();
      return;
    }
    const store = stores.find((s) => String(s.id) === String(id));
    if (!store) {
      window.location.href = storePageHref(id);
      return;
    }
    if (!placementMode && !hasFloorCoords(store)) {
      window.location.href = storePageHref(id);
      return;
    }
    selectedStore = store;
    render();
    if (onSelect) onSelect(selectedStore);
  }

  function deselect() {
    selectedStore = null;
    peekToken += 1;
    render();
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
    render();
    bindPlacementCells();
  }

  return {
    init,
    loadStores,
    selectStore,
    deselect,
    initPlacement,
    render,
    setCategoryFilter,
    hasPlacedStore,
    floorStats
  };
})();

window.MallMap = MallMap;
