// 見えているボタン・入力欄が他の要素に覆われていないか調べる
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
const VIEWS = [[1440, 900, false], [1280, 800, false], [1024, 768, true], [820, 1180, true], [390, 844, true]];
const audit = async (p, tag) => {
  const r = await p.evaluate(() => {
    const out = [];
    const vis = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    document.querySelectorAll('button, input, select, textarea, .chip, .wv-chip, a').forEach(e => {
      if (!vis(e) || e.closest('[hidden]')) return;
      const modal = document.getElementById('modal'), px = document.getElementById('pcbx');
      if (!modal.hidden && !modal.contains(e)) return;
      if (px && !px.hidden && !px.contains(e) && !e.closest('.bar') && !e.closest('.toasts')) return;
      const r = e.getBoundingClientRect();
      // 画面外 / スクロール領域で切れているものは除外
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return;
      let clip = e.parentElement, cut = false;
      while (clip && clip !== document.body) { const s = getComputedStyle(clip); if (/(auto|scroll|hidden)/.test(s.overflow + s.overflowX + s.overflowY)) { const c = clip.getBoundingClientRect(); if (r.bottom <= c.top + 1 || r.top >= c.bottom - 1 || r.right <= c.left + 1 || r.left >= c.right - 1) { cut = true; break; } } clip = clip.parentElement; }
      if (cut) return;
      // スクロール領域で一部だけ見えている場合は、見えている部分だけを調べる
      let vr = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let c = e.parentElement; c && c !== document.body; c = c.parentElement) {
        const cs = getComputedStyle(c); if (!/(auto|scroll|hidden)/.test(cs.overflow + cs.overflowX + cs.overflowY)) continue;
        const q = c.getBoundingClientRect(); vr = { left: Math.max(vr.left, q.left), top: Math.max(vr.top, q.top), right: Math.min(vr.right, q.right), bottom: Math.min(vr.bottom, q.bottom) };
      }
      if (vr.right - vr.left < 6 || vr.bottom - vr.top < 6) return;
      const pts = [[(vr.left + vr.right) / 2, (vr.top + vr.bottom) / 2], [vr.left + 3, vr.top + 3], [vr.right - 3, vr.bottom - 3]];
      const bad = pts.filter(([x, y]) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false; const t = document.elementFromPoint(x, y); return t && t !== e && !e.contains(t) && !(t.closest && t.closest('label') && t.closest('label').contains(e)); });
      if (bad.length >= 2 || (bad.length === 1 && bad[0] === pts[0])) {
        const t = document.elementFromPoint(...(bad[0]));
        const d = x => (x.id ? '#' + x.id : '') + (x.className && typeof x.className === 'string' ? '.' + x.className.trim().split(/\s+/).join('.') : '') + '<' + x.tagName.toLowerCase() + '>' + ((x.textContent || x.placeholder || '').trim().slice(0, 14));
        out.push(d(e) + '  UNDER  ' + d(t));
      }
    });
    return out;
  });
  console.log('== ' + tag + (r.length ? '' : '  OK')); r.forEach(x => console.log('   ' + x));
};
for (const [w, h, touch] of VIEWS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: w < 500 });
  const p = await ctx.newPage();
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1200);
  const T = `${w}x${h}`;
  await audit(p, T + ' 回路図');
  // 部品を選択 (操作バー)
  await p.evaluate(() => { const S = window.UniBoard.state; S.selection.add(S.doc.components[0].id); window.UniBoard.api.panels(); window.UniBoard.api.rp(); });
  await p.waitForTimeout(100); await audit(p, T + ' 選択中');
  await p.evaluate(() => { window.UniBoard.state.selection.clear(); window.UniBoard.api.panels(); });
  // シミュレーション
  await p.evaluate(() => { window.UBSim.state.cfg.type = 'tran'; window.UBSim.openDock(true); window.UBToast('テスト通知', 'ok'); });
  await p.evaluate(() => window.UBSim.run()); await p.waitForTimeout(1800);
  await p.evaluate(() => window.UBToast('テスト通知', 'ok'));
  await p.waitForTimeout(200);
  await audit(p, T + ' シミュレーション');
  await p.screenshot({ path: `${OUT}/ov-${w}-sim.png` });
  await p.evaluate(() => { const S = window.UniBoard.state; S.selection.add(S.doc.components[0].id); window.UniBoard.api.panels(); window.UniBoard.api.rp(); });
  await p.waitForTimeout(100); await audit(p, T + ' シミュ+選択');
  await p.evaluate(() => { window.UniBoard.state.selection.clear(); window.UniBoard.api.panels(); });
  // 蛇の目
  await p.evaluate(() => window.UniBoard.api.setTab('pcb')); await p.waitForTimeout(400);
  await audit(p, T + ' 蛇の目基板'); await p.screenshot({ path: `${OUT}/ov-${w}-perf.png` });
  // PCB
  await p.evaluate(() => window.UBPcb.activate(true)); await p.waitForTimeout(500);
  await p.evaluate(() => window.UBToast('テスト通知', 'ok')); await p.waitForTimeout(200);
  await audit(p, T + ' PCB'); await p.screenshot({ path: `${OUT}/ov-${w}-pcb.png` });
  await p.evaluate(() => { window.UBPcb.activate(false); window.UniBoard.api.setTab('sch'); });
  // モーダル
  await p.evaluate(() => window.UBCalc.open()); await p.waitForTimeout(300);
  await audit(p, T + ' 計算ツール'); await p.screenshot({ path: `${OUT}/ov-${w}-calc.png` });
  await ctx.close();
}
await b.close();
