// ============================================================
// PLEXI DIGITAL MALL — Map / Mall Directory
// ============================================================

const MallMap = (() => {
  const GRID_SIZE = 10; // 10x10 grid
  let stores = [];
  let selectedStore = null;
  let container = null;
  let onSelect = null;

  function init(containerEl, onSelectCb = null) {
    container = containerEl;
    onSelect  = onSelectCb;
    render();
    loadStores();
  }

  async function loadStores() {
    try {
      const data = await api.map.stores();
      stores = Array.isArray(data) ? data : (data.stores || []);
      render();
    } catch (err) {
      console.error('Map load error:', err);
    }
  }

  function getStoreAt(x, y) {
    return stores.find(s => {
      const cx = s.coordinates?.x ?? -1;
      const cy = s.coordinates?.y ?? -1;
      return cx === x && cy === y;
    });
  }

  function getCategoryColor(category = '') {
    const colors = {
      fashion:     '#E74C3C',
      electronics: '#3498DB',
      food:        '#F39C12',
      beauty:      '#9B59B6',
      sports:      '#27AE60',
      home:        '#1ABC9C',
      books:       '#E67E22',
      toys:        '#F1C40F',
    };
    const key = category.toLowerCase();
    return colors[key] || '#7F8C8D';
  }

  function render() {
    if (!container) return;
    const iw = container.clientWidth || 600;
    const cellSize = Math.max(48, Math.floor((iw - 40) / GRID_SIZE));
    const totalW   = cellSize * GRID_SIZE;
    const totalH   = cellSize * GRID_SIZE;

    let html = `
      <div style="overflow:auto;padding:var(--space-md);">
        <div style="display:flex;gap:var(--space-md);margin-bottom:var(--space-md);flex-wrap:wrap;">
          ${legendHTML()}
        </div>
        <div class="mall-grid neo-inset-lg" style="
          display:grid;
          grid-template-columns:repeat(${GRID_SIZE},${cellSize}px);
          grid-template-rows:repeat(${GRID_SIZE},${cellSize}px);
          width:${totalW}px;
          height:${totalH}px;
          border-radius:var(--radius-lg);
          overflow:hidden;
          gap:2px;
          background:var(--border-light);
        ">
    `;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const store = getStoreAt(x, y);
        const isSelected = selectedStore?.id === store?.id;
        const color = store ? getCategoryColor(store.category) : null;

        html += `
          <div
            class="mall-cell ${store ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}"
            data-x="${x}" data-y="${y}"
            style="
              background:${store ? color + '18' : 'var(--bg)'};
              border:${isSelected ? `2px solid ${color}` : `1px solid var(--border-light)`};
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              cursor:${store ? 'pointer' : 'default'};
              transition:all 0.2s;
              border-radius:4px;
              padding:4px;
              position:relative;
              ${store ? `box-shadow: inset 0 0 0 2px ${color}22;` : ''}
            "
            ${store ? `onclick="MallMap.selectStore('${store.id}')" title="${store.name}"` : ''}
          >
            ${store ? `
              ${store.featured ? '<div style="position:absolute;top:2px;right:2px;width:6px;height:6px;border-radius:50%;background:var(--secondary)"></div>' : ''}
              <div style="
                width:28px;height:28px;border-radius:6px;
                background:${color};
                display:flex;align-items:center;justify-content:center;
                color:#fff;font-size:11px;font-weight:700;
                margin-bottom:2px;
                box-shadow:0 2px 6px ${color}55;
              ">${(store.name||'?').charAt(0).toUpperCase()}</div>
              <div style="font-size:8px;font-weight:600;color:var(--text-secondary);text-align:center;line-height:1.2;overflow:hidden;max-width:100%;">
                ${store.name.length > 8 ? store.name.slice(0,7)+'…' : store.name}
              </div>
            ` : `
              <div style="width:16px;height:1px;background:var(--border);border-radius:1px;"></div>
            `}
          </div>
        `;
      }
    }

    html += `</div>`;

    // Store detail panel
    if (selectedStore) {
      html += storeDetailPanel(selectedStore);
    }

    html += `</div>`;
    container.innerHTML = html;

    // Hover effects via JS
    container.querySelectorAll('.mall-cell.occupied').forEach(cell => {
      cell.addEventListener('mouseenter', () => {
        cell.style.transform = 'scale(1.06)';
        cell.style.zIndex = '10';
      });
      cell.addEventListener('mouseleave', () => {
        cell.style.transform = '';
        cell.style.zIndex = '';
      });
    });
  }

  function legendHTML() {
    const cats = ['Fashion','Electronics','Food','Beauty','Sports','Home','Books','Toys'];
    return cats.map(c => {
      const color = getCategoryColor(c);
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-secondary);">
        <div style="width:10px;height:10px;border-radius:3px;background:${color};"></div>${c}
      </div>`;
    }).join('');
  }

  function storeDetailPanel(store) {
    return `
      <div class="animate-fadeIn" style="
        margin-top:var(--space-lg);
        background:var(--surface);
        border-radius:var(--radius-xl);
        border:1px solid var(--border-light);
        overflow:hidden;
        box-shadow:0 4px 16px rgba(0,0,0,0.06);
      ">
        <div style="height:80px;background:linear-gradient(135deg,${getCategoryColor(store.category)},${getCategoryColor(store.category)}88);position:relative;overflow:hidden;">
          ${store.banner ? `<img src="${store.banner}" style="width:100%;height:100%;object-fit:cover;opacity:0.7">` : ''}
          <div style="position:absolute;inset:0;display:flex;align-items:center;padding:var(--space-md);gap:var(--space-sm);">
            <div style="width:48px;height:48px;border-radius:var(--radius-md);background:white;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:${getCategoryColor(store.category)};border:2px solid white;">
              ${(store.name||'?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-family:var(--font-display);font-weight:700;color:white;font-size:16px;">${store.name}</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.8);">${store.category}</div>
            </div>
            ${store.featured ? '<span class="badge badge-secondary" style="margin-left:auto;">⭐ Featured</span>' : ''}
          </div>
        </div>
        <div style="padding:var(--space-md);">
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:var(--space-md);">${store.description || 'No description available.'}</p>
          <div style="display:flex;gap:var(--space-sm);">
            <a href="../store/store.html?id=${store.id}" class="btn btn-primary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 3h22l-2 13H3L1 3z"/><path d="M16 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/><path d="M6 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0z"/></svg>
              Visit Store
            </a>
            <button class="btn btn-ghost btn-sm" onclick="MallMap.deselect()">Close</button>
          </div>
        </div>
      </div>
    `;
  }

  function selectStore(id) {
    const store = stores.find(s => s.id === id);
    selectedStore = store || null;
    render();
    if (onSelect) onSelect(selectedStore);
  }

  function deselect() {
    selectedStore = null;
    render();
  }

  // Drag-and-drop placement for sellers/admin
  function initPlacement(storeId) {
    if (!container) return;
    const cells = container.querySelectorAll('.mall-cell.empty');
    cells.forEach(cell => {
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
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        try {
          await api.map.update(storeId, { x, y });
          UI.toast('Store position updated!', 'success');
          await loadStores();
        } catch (err) {
          UI.toast(err.message || 'Failed to update position', 'error');
        }
      });
    });
  }

  return { init, loadStores, selectStore, deselect, initPlacement, render };
})();

window.MallMap = MallMap;