// ============================================================
// PLEXI DIGITAL MALL — Map / Mall Directory
// ============================================================

const MallMap = (() => {
  const GRID_SIZE = 10; // full floor for seller/admin placement
  let stores = [];
  let selectedStore = null;
  let container = null;
  let onSelect = null;
  let placementMode = false;
  let placementStoreId = null;
  let resizeTimer = null;

  function storePageHref(id) {
    const prefix = /\/(store|dashboard)\//.test(location.pathname) ? '../' : '';
    return `${prefix}store/store.html?id=${id}`;
  }

  function init(containerEl, onSelectCb = null) {
    container = containerEl;
    onSelect = onSelectCb;
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
  }

  function occupiedStores() {
    return stores.filter((s) => {
      const x = Number(s.coordinates?.x);
      const y = Number(s.coordinates?.y);
      return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0;
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
    const availH = Math.min(380, Math.max(200, Math.floor(window.innerHeight * 0.42)));
    const byW = Math.floor(availW / cols);
    const byH = Math.floor(availH / rows);
    return Math.max(40, Math.min(byW, byH, 96));
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

  function render() {
    if (!container) return;
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
        const letterSize = Math.max(16, Math.min(32, Math.floor(cellSize * 0.42)));
        const nameSize = Math.max(8, Math.min(12, Math.floor(cellSize * 0.18)));

        html += `
          <div
            class="mall-cell ${store ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}"
            data-x="${x}" data-y="${y}"
            style="
              background:${store ? color + '18' : 'var(--bg)'};
              border:${isSelected ? `3px solid ${color}` : `1px solid var(--border-light)`};
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              cursor:${store ? 'pointer' : 'default'};
              transition:transform 0.15s ease, box-shadow 0.15s ease;
              border-radius:4px;
              padding:3px;
              position:relative;
              z-index:${isSelected ? '4' : '1'};
              transform:${isSelected ? 'scale(1.08)' : 'none'};
              ${store ? `box-shadow: inset 0 0 0 2px ${color}22;` : ''}
              ${isSelected ? `box-shadow:0 6px 18px ${color}55;` : ''}
            "
            ${store ? `onclick="MallMap.selectStore('${store.id}')" title="${store.name}"` : ''}
          >
            ${store ? `
              ${store.featured ? '<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--secondary)"></div>' : ''}
              <div style="
                width:${letterSize}px;height:${letterSize}px;border-radius:6px;
                background:${color};
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-size:${Math.max(10, Math.floor(letterSize * 0.45))}px;font-weight:700;
                margin-bottom:2px;
                box-shadow:0 2px 6px ${color}55;
              ">${(store.name || '?').charAt(0).toUpperCase()}</div>
              <div style="font-size:${nameSize}px;font-weight:600;color:var(--text-secondary);text-align:center;line-height:1.2;overflow:hidden;max-width:100%;">
                ${store.name.length > 10 ? store.name.slice(0, 9) + '…' : store.name}
              </div>
            ` : `
              <div style="width:16px;height:1px;background:var(--border);border-radius:1px;"></div>
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
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);">
        <div style="width:10px;height:10px;border-radius:3px;background:${color};"></div>${c}
      </div>`;
    }).join('');
  }

  function placePeek(store) {
    const wrap = container.querySelector('.mall-map-wrap');
    const cell = container.querySelector('.mall-cell.selected');
    if (!wrap || !cell) return;
    const color = getCategoryColor(store.category);
    const pop = document.createElement('div');
    pop.id = 'mall-store-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', store.name);
    pop.style.cssText = 'position:absolute;z-index:20;width:min(280px,calc(100% - 16px));background:var(--surface);border:1px solid var(--border-light);border-radius:var(--radius-lg);box-shadow:0 12px 32px rgba(0,0,0,0.18);overflow:hidden;';
    pop.innerHTML = `
      <div style="height:56px;background:linear-gradient(135deg,${color},${color}88);position:relative;overflow:hidden;">
        ${store.banner ? `<img src="${store.banner}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0.7">` : ''}
      </div>
      <div style="padding:var(--space-md);">
        <div style="font-family:var(--font-display);font-weight:700;font-size:16px;margin-bottom:2px;">${store.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:var(--space-sm);">${store.category || ''}</div>
        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-md);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${store.description || 'Pop in and browse this shop.'}</p>
        <div style="display:flex;gap:var(--space-sm);">
          <a href="${storePageHref(store.id)}" class="btn btn-primary btn-sm">Visit Store</a>
          <button type="button" class="btn btn-ghost btn-sm" onclick="MallMap.deselect()">Close</button>
        </div>
      </div>`;
    wrap.appendChild(pop);

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
    requestAnimationFrame(() => {
      pop.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }

  function selectStore(id) {
    if (selectedStore?.id === id) {
      deselect();
      return;
    }
    const store = stores.find((s) => s.id === id);
    selectedStore = store || null;
    render();
    if (onSelect) onSelect(selectedStore);
  }

  function deselect() {
    selectedStore = null;
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

  return { init, loadStores, selectStore, deselect, initPlacement, render };
})();

window.MallMap = MallMap;
