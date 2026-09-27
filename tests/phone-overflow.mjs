// スマートフォン幅で画面の外にはみ出す要素を探す
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
for (const w of [280, 300, 320, 360, 393, 412]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.75 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { window.AndroidBridge = { saveFile() { }, platform: () => 'android' }; });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1200);
  for (const view of ['sch', 'pcb', 'pcbx', 'sim']) {
    await p.evaluate(v => {
      if (window.UBPcb.state.active) window.UBPcb.activate(false);
      window.UBSim.openDock(false); window.UniBoard.api.setTab(v === 'pcb' ? 'pcb' : 'sch');
      if (v === 'pcbx') window.UBPcb.activate(true);
      if (v === 'sim') window.UBSim.openDock(true);
    }, view);
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const W = innerWidth, out = [];
      document.querySelectorAll('body *').forEach(e => {
        if (e.closest('[hidden]') || e.closest('svg') || e.tagName === 'OPTION') return;
        const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return;
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
        // スクロール領域の中身は除外
        let c = e.parentElement, inScroll = false; while (c && c !== document.body) { const cs = getComputedStyle(c); if (/(auto|scroll)/.test(cs.overflowX + cs.overflow)) { inScroll = true; break; } c = c.parentElement; }
        if (inScroll) return;
        if (r.right > W + 1 || r.left < -1) out.push(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${String(e.className).split(' ')[0]} [${Math.round(r.left)}..${Math.round(r.right)}] ${(e.textContent || '').trim().slice(0, 12)}`);
      });
      return { sw: document.documentElement.scrollWidth, sy: Math.round(document.scrollingElement.scrollTop), bar: Math.round(document.querySelector('.bar').getBoundingClientRect().height), out: out.slice(0, 12) };
    });
    console.log(w, view, 'scrollW', r.sw, 'scrollTop', r.sy, 'barH', r.bar); r.out.forEach(x => console.log('   ', x));
    if (w === 300 || w === 360) await p.screenshot({ path: `${OUT}/ph-${w}-${view}.png` });
  }
  await ctx.close();
}
await b.close();
