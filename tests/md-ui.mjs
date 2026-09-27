// Android (Material Design 3) 表示の確認: 画面ごとのスクリーンショットと、はみ出し・JS エラーの検出
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
let bad = 0;
for (const [w, h, dark] of [[360, 780, false], [360, 780, true], [320, 640, false], [820, 1180, false]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 600, hasTouch: true, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light' });
  const p = await ctx.newPage();
  const errs = [], bars = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { window.AndroidBridge = { saveFile() { }, platform: () => 'android', haptic() { }, setSystemBars(a, b, l) { (window.__bars = window.__bars || []).push([a, b, l]); } }; });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1200);
  const tag = `${w}${dark ? 'd' : ''}`;
  const md = await p.evaluate(() => document.documentElement.classList.contains('md'));
  if (!md) { console.log('md クラスが付いていない'); bad++; }
  const check = async name => {
    const r = await p.evaluate(() => {
      const W = innerWidth, H = innerHeight, out = [];
      document.querySelectorAll('.bar *, .md-nav *, .md-fab, .zoombox, .px-bar *, .md-menu *').forEach(e => {
        if (e.closest('[hidden]') || e.closest('svg') || e.closest('.md-rh')) return;
        const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return;
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1) out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]} [${Math.round(r.left)}..${Math.round(r.right)}]`);
      });
      return { out: out.slice(0, 8), bar: Math.round(document.querySelector('.bar').getBoundingClientRect().height) };
    });
    console.log(tag, name, 'barH', r.bar, r.out.length ? 'はみ出し: ' + r.out.join(' ') : 'OK');
    if (r.out.length) bad++;
    await p.screenshot({ path: `${OUT}/md-${tag}-${name}.png` });
  };
  await check('sch');
  await p.click('.md-more'); await p.waitForTimeout(250); await check('menu');
  await p.keyboard.press('Escape'); await p.mouse.click(5, h - 200); await p.waitForTimeout(100);
  if (w < 600) { await p.click('.md-navbtn'); await p.waitForTimeout(350); await check('drawer'); await p.evaluate(() => { UniBoard.state.palOpen = false; UniBoard.api.applyPanels(); }); }
  await p.evaluate(() => { UniBoard.state.inspOpen = true; UniBoard.api.applyPanels(); }); await p.waitForTimeout(400); await check('insp');
  await p.evaluate(() => { UniBoard.state.inspOpen = false; UniBoard.api.applyPanels(); });
  await p.click('.md-nav-it[data-for="tabPcb"]'); await p.waitForTimeout(500); await check('perf');
  await p.click('.md-nav-it[data-for="tabPcbx"]'); await p.waitForTimeout(500); await check('pcbx');
  await p.click('.md-nav-it[data-for="tabSch"]'); await p.waitForTimeout(300);
  await p.click('.md-fab'); await p.waitForTimeout(1500); await check('sim');
  await p.evaluate(() => UBSim.openDock(false));
  await p.click('#bCalc'); await p.waitForTimeout(400); await check('calc');
  await p.evaluate(() => { document.getElementById('modal').hidden = true; window.UBToast('保存しました', 'ok'); }); await p.waitForTimeout(300); await check('snack');
  const sb = await p.evaluate(() => window.__bars && window.__bars.slice(-1)[0]);
  console.log(tag, 'systemBars', JSON.stringify(sb), errs.length ? 'JS エラー: ' + errs.join(' | ') : '');
  if (errs.length) bad++;
  await ctx.close();
}
await b.close();
console.log(bad ? `NG ${bad}` : 'ALL OK');
