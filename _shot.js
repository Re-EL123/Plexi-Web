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
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  const role = process.argv[2] || 'shopper';
  await page.addInitScript(API_SHIM);
  await page.addInitScript((r) => {
    const user = { id:'u1', email:'test@plexi.dev', role:r, metadata:{ name:'Test User' } };
    localStorage.setItem('authToken','fake'); localStorage.setItem('plexiUser', JSON.stringify(user));
  }, role);
  const url = 'file://' + path.resolve('/home/akani/Plexi-Web', 'dashboard', role + '.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/home/akani/Plexi-Web/_shot_' + role + '.png', fullPage: false });
  console.log('screenshot written for', role);
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
