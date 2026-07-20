const { chromium } = require('/home/akani/.config/goose/mcp-hermit/.hermit/node/cache/_npx/5c6d8c4f680fcd0a/node_modules/playwright-core');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const results = {};
  for (const pageName of ['login.html', 'signup.html']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
    const url = 'file://' + path.resolve(process.cwd(), pageName);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const checks = await page.evaluate(() => {
      const out = {};
      const btn = document.querySelector('.btn-primary');
      out.btnBg = btn ? getComputedStyle(btn).backgroundImage.slice(0, 30) : 'MISSING';
      const card = document.querySelector('.auth-card');
      out.cardShadow = card ? getComputedStyle(card).boxShadow.slice(0, 20) : 'MISSING';
      const visual = document.querySelector('.auth-visual');
      out.visualAnim = visual ? getComputedStyle(visual).animationName : 'MISSING';
      out.blobs = document.querySelectorAll('.auth-blob').length;
      const fc = document.querySelector('.input-group');
      out.formShadow = fc ? getComputedStyle(fc).boxShadow.slice(0, 20) : 'MISSING';
      const edge = document.querySelector('.auth-card-edged');
      out.edgePseudo = edge ? getComputedStyle(edge, '::before').backgroundImage.slice(0,20) : 'MISSING';
      return out;
    });
    await page.screenshot({ path: `shot_${pageName.replace('.html','')}.png` });
    results[pageName] = { errors, checks };
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
