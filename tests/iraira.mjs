import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import fs from 'node:fs';
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1000);
// 「読み込み」→ 貼り付けで読み込む (ユーザーと同じ手順)
await p.click('#bImport'); await p.click('.pastebox summary');
await p.fill('.pastebox textarea', fs.readFileSync('examples/iraira-stick.json', 'utf8'));
await p.click('text=貼り付けた内容を読み込む'); await p.waitForTimeout(600);
await p.screenshot({ path: OUT + '/ira-sch.png' });
// STICK を COURSE に触れさせたとき (J1 と J4 を配線でつなぐ) のシミュレーション
const r = await p.evaluate(async () => {
  const st = window.UniBoard.state, CD = window.CADDoc;
  const base = CD.serialize(st.doc);
  const run = async () => { window.UBSim.state.cfg.type = 'tran'; window.UBSim.state.cfg.tstop = '0.3'; window.UBSim.state.cfg.start = 'power'; await window.UBSim.run(); return window.UBSim.state; };
  const val = (S, n) => { const k = S.res.names.indexOf(n); return k < 0 ? null : S.res.data[k][S.res.data[k].length - 1]; };
  let S = await run();
  const off = { red: val(S, 'i(dd2)'), blue: val(S, 'i(dd1)'), log: S.log.map(m => m.t) };
  // 一瞬だけ接触 → 離しても鳴り続ける (自己保持) か
  st.doc.components.push({ id: 'ctest', type: 'VPULSE', x: 0, y: 0, rot: 0, ref: 'VT', val: 'PULSE(0 5 0.05 1u 1u 0.02 10)', props: {} });
  return { off, base: base.length };
});
console.log(JSON.stringify(r));
await p.click('#tabPcb'); await p.waitForTimeout(300); await p.click('#bReseed'); await p.waitForTimeout(3500);
console.log(await p.evaluate(() => { const b = window.UniBoard.state.board; return b.board.cols + 'x' + b.board.rows + ' routed ' + b.result.metrics.routed + '/' + b.result.metrics.nets + ' drc ' + b.problems.length; }));
await p.screenshot({ path: OUT + '/ira-perf.png' });
console.log('ERR', errs.join('\n') || 'none');
await b.close();
