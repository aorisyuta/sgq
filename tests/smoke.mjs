import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html');
await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + '/01-start.png' });
// シミュレーション
await p.click('#bSim'); await p.waitForTimeout(300);
await p.click('#dkRun'); await p.waitForTimeout(2500);
await p.screenshot({ path: OUT + '/02-sim.png' });
const log = await p.evaluate(() => window.UBSim.state.log.map(m => m.lv + ':' + m.t).join('\n'));
console.log('SIMLOG', log);
// OP
await p.evaluate(() => { window.UBSim.state.cfg.type = 'op'; });
await p.evaluate(() => window.UBSim.run()); await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + '/03-op.png' });
// PCB
await p.click('.md-nav-it[data-for="tabPcbx"]'); await p.waitForTimeout(800);
await p.screenshot({ path: OUT + '/04-pcb.png' });
const un = await p.evaluate(() => window.UBPcb.autoRoute()); await p.waitForTimeout(500);
console.log('unrouted', un);
await p.screenshot({ path: OUT + '/05-pcb-routed.png' });
const drc = await p.evaluate(() => window.UBPcb.runDRC().map(m => m.lv + ':' + m.t).slice(0, 10).join('\n'));
console.log('DRC', drc);
const files = await p.evaluate(() => window.UBPcb.gerberFiles().map(f => f[0] + ' ' + f[1].length));
console.log(files.join('\n'));
await p.evaluate(() => { window.UBPcb.state.mode = 'real'; window.UBPcb.render(); });
await p.screenshot({ path: OUT + '/06-pcb-real.png' });
await p.click('.md-nav-it[data-for="tabSch"]'); await p.waitForTimeout(300);
// 計算ツール
await p.click('#bCalc'); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + '/07-calc.png' });
await p.click('#modalClose');
// コマンドパレット
await p.keyboard.press('Control+k'); await p.keyboard.type('2sc1815'); await p.waitForTimeout(200);
await p.screenshot({ path: OUT + '/08-cmdk.png' });
await p.keyboard.press('Escape');
// ライブラリ検索
await p.fill('#libQ', 'NE555'); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + '/09-lib.png' });
// 暗いテーマ
await p.fill('#libQ', ''); await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); window.CADRender.readTheme(); window.UniBoard.api.rp(); });
await p.waitForTimeout(300);
await p.screenshot({ path: OUT + '/10-dark.png' });
// 狭い画面
await p.setViewportSize({ width: 400, height: 820 }); await p.waitForTimeout(500);
await p.screenshot({ path: OUT + '/11-phone.png' });
console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
await b.close();
