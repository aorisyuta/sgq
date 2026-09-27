import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + '\n' + e.stack));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1200);
const res = {};
// ライブラリから 2SC1815 を配置
await p.fill('#libQ', '2sc1815'); await p.waitForTimeout(200);
await p.click('.lr >> nth=0');
const cv = await p.locator('#cv').boundingBox();
await p.mouse.click(cv.x + 200, cv.y + 450); await p.waitForTimeout(200);
res.placed = await p.evaluate(() => { const c = window.UniBoard.state.doc.components.slice(-1)[0]; return c.type + ' ' + c.val + ' ' + c.ref; });
await p.keyboard.press('Escape');
await p.fill('#libQ', '');
// 元に戻す
await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
res.afterUndo = await p.evaluate(() => window.UniBoard.state.doc.components.length);
// プローブ: 配線をクリック
await p.evaluate(() => { window.UBSim.state.cfg.type = 'tran'; window.UBSim.state.cfg.tstop = ''; });
await p.click('#bRunQ'); await p.waitForTimeout(2000);
res.log = await p.evaluate(() => window.UBSim.state.log.map(m => m.t));
await p.click('#tProbe');
const pt = await p.evaluate(() => { const S = window.UniBoard.state, w = S.doc.wires[3], v = S.vSch; return [(w.x1 + w.x2) / 2 * v.z + v.x, (w.y1 + w.y2) / 2 * v.z + v.y]; });
await p.mouse.click(cv.x + pt[0], cv.y + pt[1]); await p.waitForTimeout(300);
res.probes = await p.evaluate(() => window.UBSim.state.probes.map(x => x.name));
await p.screenshot({ path: OUT + '/i1-probe.png' });
await p.keyboard.press('Escape');
// 蛇の目基板
await p.click('#tabPcb'); await p.waitForTimeout(400);
await p.click('#bReseed'); await p.waitForTimeout(3000);
res.perf = await p.evaluate(() => { const b = window.UniBoard.state.board; return b ? b.board.cols + 'x' + b.board.rows + ' routed ' + b.result.metrics.routed + '/' + b.result.metrics.nets + ' drc ' + b.problems.length : 'none'; });
await p.screenshot({ path: OUT + '/i2-perf.png' });
// PCB で手動配線
await p.click('#tabPcbx'); await p.waitForTimeout(500);
await p.evaluate(() => { const P = window.UBPcb.state; P.tracks = []; P.vias = []; window.UBPcb.render(); });
const pads = await p.evaluate(() => {
  const P = window.UBPcb.state, n = P.nets.find(n => n.pads.length === 2 && !n.power) || P.nets.find(n => n.pads.length >= 2);
  const v = P.view;
  const w = n.pads.map(([ci, pi]) => { const c = P.comps[ci], pd = c.pads[pi]; let lx = pd.x; if (c.side === 'bottom') lx = -lx; const [dx, dy] = window.CADCore.rotXY(lx, pd.y, c.rot); return [(c.x + dx) * v.z + v.x, (c.y + dy) * v.z + v.y]; });
  return { name: n.name, w };
});
const pcv = await p.locator('#pxCv').boundingBox();
await p.keyboard.press('w');
await p.mouse.click(pcv.x + pads.w[0][0], pcv.y + pads.w[0][1]); await p.waitForTimeout(100);
await p.mouse.move(pcv.x + pads.w[1][0], pcv.y + pads.w[1][1]); await p.waitForTimeout(100);
await p.mouse.click(pcv.x + pads.w[1][0], pcv.y + pads.w[1][1]); await p.waitForTimeout(200);
res.manual = await p.evaluate(() => ({ tracks: window.UBPcb.state.tracks.length, route: !!window.UBPcb.state.route }));
res.net = pads.name;
await p.screenshot({ path: OUT + '/i3-manual.png' });
await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
res.afterUndoPcb = await p.evaluate(() => window.UBPcb.state.tracks.length);
// 画面の切替
await p.click('#tabSch'); await p.waitForTimeout(200);
res.pcbHidden = await p.evaluate(() => document.getElementById('pcbx').hidden);
// ネットリスト編集で直接実行
await p.evaluate(() => { const S = window.UBSim.state; S.useCustom = true; S.custom = 'test\nV1 a 0 SIN(0 1 1k)\nR1 a b 1k\nC1 b 0 1u\n'; S.cfg.type = 'tran'; S.cfg.tstop = '5m'; });
await p.evaluate(() => window.UBSim.run()); await p.waitForTimeout(1500);
res.custom = await p.evaluate(() => ({ log: window.UBSim.state.log.map(m => m.t), probes: window.UBSim.state.probes.map(x => x.name) }));
console.log(JSON.stringify(res, null, 1));
console.log('ERR', errs.join('\n') || 'none');
await b.close();
