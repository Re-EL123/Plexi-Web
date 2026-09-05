// ============================================================
// PLEXI DIGITAL MALL — In-app tour (admin-editable steps)
// ============================================================

const PlexiTour = (() => {
  let steps = [];
  let index = 0;
  let version = 1;
  let pageKey = 'home';
  let active = false;
  let nodes = null;

  function detectPage() {
    const path = location.pathname || '';
    if (/shopper\.html/.test(path)) return 'shopper';
    if (/seller\.html/.test(path)) return 'seller';
    if (/admin\.html/.test(path)) return 'admin';
    return 'home';
  }

  function audience() {
    try {
      if (window.Auth && Auth.isLoggedIn && Auth.isLoggedIn()) {
        const role = Auth.getUser()?.role;
        if (role === 'shopper' || role === 'seller' || role === 'admin') return role;
      }
    } catch (_) {}
    return 'guest';
  }

  function storageKey(page) {
    return `plexiTour:${page || pageKey}`;
  }

  function seen(page, ver) {
    try { return localStorage.getItem(storageKey(page)) === String(ver); } catch (_) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(storageKey(pageKey), String(version)); } catch (_) {}
  }

  function resolveTarget(name) {
    if (!name) return null;
    const key = String(name).trim();
    if (!/^[a-z][a-z0-9_-]{0,39}$/i.test(key)) return null;
    return document.querySelector(`[data-tour="${key}"]`);
  }

  function reduced() {
    return window.UI && UI.prefersReducedMotion && UI.prefersReducedMotion();
  }

  function filterSteps(items, page, role) {
    return (items || [])
      .filter((s) => s && s.active !== false && s.title)
      .filter((s) => {
        const p = s.page || 'any';
        const a = s.audience || 'all';
        const pageOk = p === 'any' || p === page;
        const roleOk = a === 'all' || a === role || (a === 'guest' && role === 'guest');
        return pageOk && roleOk;
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }

  async function loadSteps(page) {
    pageKey = page || detectPage();
    let doc = { items: [], version: 1 };
    try {
      const all = await SiteContent.load();
      doc = all?.tour || await SiteContent.load('tour');
    } catch (_) {}
    version = Number(doc?.version) || 1;
    steps = filterSteps(doc?.items, pageKey, audience());
    return steps;
  }

  function ensureDom() {
    if (nodes) return nodes;
    const root = document.createElement('div');
    root.id = 'plexi-tour';
    root.className = 'tour-root';
    root.hidden = true;
    root.innerHTML = `
      <div class="tour-spot" id="tour-spot" hidden></div>
      <div class="tour-card neo-card" id="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <div class="tour-progress" id="tour-progress"></div>
        <h3 id="tour-title" class="tour-title"></h3>
        <div id="tour-body" class="tour-body markdown-body"></div>
        <div class="tour-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="tour-skip">Skip</button>
          <div class="tour-nav">
            <button type="button" class="btn btn-ghost btn-sm" id="tour-back">Back</button>
            <button type="button" class="btn btn-primary btn-sm" id="tour-next">Next</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);
    nodes = {
      root,
      spot: root.querySelector('#tour-spot'),
      card: root.querySelector('#tour-card'),
      title: root.querySelector('#tour-title'),
      body: root.querySelector('#tour-body'),
      progress: root.querySelector('#tour-progress'),
      skip: root.querySelector('#tour-skip'),
      back: root.querySelector('#tour-back'),
      next: root.querySelector('#tour-next')
    };
    nodes.skip.addEventListener('click', stop);
    nodes.back.addEventListener('click', () => go(index - 1));
    nodes.next.addEventListener('click', () => {
      if (index >= steps.length - 1) stop();
      else go(index + 1);
    });
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('scroll', onResize, { passive: true });
    return nodes;
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); nodes.next.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (index > 0) go(index - 1); }
  }

  function onResize() {
    if (active) layout();
  }

  function layout() {
    const step = steps[index];
    if (!step || !nodes) return;
    const target = resolveTarget(step.target);
    const spot = nodes.spot;
    const card = nodes.card;
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mobile = vw < 700;

    if (target) {
      if (target.dataset.section && window.Dashboard && typeof Dashboard.showSection === 'function') {
        Dashboard.showSection(target.dataset.section);
      }
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      const r = target.getBoundingClientRect();
      spot.hidden = false;
      spot.style.top = Math.max(8, r.top - pad) + 'px';
      spot.style.left = Math.max(8, r.left - pad) + 'px';
      spot.style.width = Math.min(vw - 16, r.width + pad * 2) + 'px';
      spot.style.height = Math.min(vh - 16, r.height + pad * 2) + 'px';
      if (mobile) {
        card.style.left = '12px';
        card.style.right = '12px';
        card.style.width = 'auto';
        card.style.top = '';
        card.style.bottom = '16px';
        card.style.transform = '';
      } else {
        card.style.right = '';
        card.style.bottom = '';
        card.style.width = Math.min(360, vw - 24) + 'px';
        let top = r.bottom + 16;
        let left = Math.min(Math.max(12, r.left), vw - 372);
        if (top + 240 > vh) top = Math.max(12, r.top - 248);
        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.style.transform = '';
      }
    } else {
      spot.hidden = true;
      card.style.right = '';
      card.style.bottom = '';
      card.style.width = Math.min(400, vw - 32) + 'px';
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.transform = 'translate(-50%, -50%)';
    }
  }

  function paint() {
    const step = steps[index];
    if (!step) return stop();
    nodes.title.textContent = step.title;
    nodes.body.innerHTML = SiteContent.renderMarkdown(step.body || '');
    nodes.progress.textContent = `${index + 1} / ${steps.length}`;
    nodes.back.disabled = index === 0;
    nodes.next.textContent = index >= steps.length - 1 ? 'Done' : 'Next';
    layout();
    nodes.next.focus();
  }

  function go(i) {
    if (i < 0 || i >= steps.length) return;
    index = i;
    paint();
  }

  function stop() {
    if (!active) return;
    active = false;
    markSeen();
    if (nodes) nodes.root.hidden = true;
    document.documentElement.classList.remove('tour-open');
  }

  async function start(opts = {}) {
    const page = opts.page || detectPage();
    await loadSteps(page);
    if (!steps.length) {
      if (opts.force && window.UI) UI.toast('No tour steps for this page yet.', 'info');
      return false;
    }
    ensureDom();
    index = 0;
    active = true;
    nodes.root.hidden = false;
    document.documentElement.classList.add('tour-open');
    paint();
    return true;
  }

  async function autoStart(opts = {}) {
    const page = opts.page || detectPage();
    if (page === 'admin') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !opts.force) {
      await loadSteps(page);
      return;
    }
    await loadSteps(page);
    if (!steps.length) return;
    if (!opts.force && seen(page, version)) return;
    const wait = () => document.querySelector('.needed-action-modal.show, .modal.show');
    const tryStart = () => {
      if (wait()) {
        setTimeout(tryStart, 1200);
        return;
      }
      start({ page, force: true });
    };
    setTimeout(tryStart, 1400);
  }

  return { start, stop, autoStart, detectPage };
})();

window.PlexiTour = PlexiTour;
