const PW = '/home/akani/.config/goose/mcp-hermit/.hermit/node/cache/_npx/5c6d8c4f680fcd0a/node_modules/playwright-core';
const { chromium } = require(PW);
const path = require('path');

const API_SHIM = `
window.CONFIG = window.CONFIG || {};
window.CONFIG.TOKEN_KEY='authToken'; window.CONFIG.USER_KEY='plexiUser';
window.CONFIG.STORE_STATUSES={draft:{label:'Draft',color:'gray'},published:{label:'Published',color:'success'},suspended:{label:'Suspended',color:'error'},rejected:{label:'Rejected',color:'error'}};
window.CONFIG.ORDER_STATUSES={pending:{label:'Pending',color:'warning'},processing:{label:'Processing',color:'info'},shipped:{label:'Shipped',color:'info'},delivered:{label:'Delivered',color:'success'},cancelled:{label:'Cancelled',color:'error'}};
window.CONFIG.TICKET_PRIORITIES={low:{label:'Low',color:'gray'},medium:{label:'Medium',color:'info'},high:{label:'High',color:'error'}};
window.CONFIG.TICKET_STATUSES={open:{label:'Open',color:'warning'},in_progress:{label:'In Progress',color:'info'},resolved:{label:'Resolved',color:'success'},closed:{label:'Closed',color:'gray'}};
window.CONFIG.PLANS={free:{label:'Free',price:0,storeLimit:1},pro:{label:'Pro',price:199,storeLimit:5},business:{label:'Business',price:499,storeLimit:20},custom:{label:'Custom',price:0,storeLimit:50}};
window.api = new Proxy({}, { get: () => async () => ({}) });
`;

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const results = {};
  for (const pageName of ['admin.html', 'seller.html', 'shopper.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
    await page.addInitScript(API_SHIM);
    await page.addInitScript(() => {
      const role = location.pathname.includes('admin')?'admin':location.pathname.includes('seller')?'seller':'shopper';
      const user = { id:'u1', email:'test@plexi.dev', role, metadata:{ name:'Test User' } };
      localStorage.setItem('authToken','fake'); localStorage.setItem('plexiUser', JSON.stringify(user));
    });
    const url = 'file://' + path.resolve('/home/akani/Plexi-Web', 'dashboard', pageName);
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const checks = await page.evaluate(() => {
      const probe = (sel) => { const el = document.querySelector(sel); if (!el) return 'MISSING'; const cs = getComputedStyle(el); return { display: cs.display, shadow: cs.boxShadow!=='none', bg: cs.backgroundColor }; };
      const sb = document.querySelector('.sidebar');
      const sg = document.querySelector('.stats-grid');
      return {
        sidebarW: sb ? getComputedStyle(sb).width : 'MISSING',
        sidebarNav: probe('.sidebar-nav'),
        statCard: probe('.stat-card'),
        cardHeader: probe('.card-header'),
        tableWrap: probe('.table-wrap'),
        btnIcon: probe('.btn-icon'),
        statsGridCols: sg ? getComputedStyle(sg).gridTemplateColumns : 'MISSING',
        productCard: probe('.product-card'),
        avatarXl: probe('.avatar-xl'),
      };
    });
    await page.screenshot({ path: `shot_dash_${pageName.replace('.html','')}.png` });
    results[pageName] = { errors, checks };
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
