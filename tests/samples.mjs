// SPICE サンプルを順に読み込んで実行し、結果とスクリーンショットを確認
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1200);
for (let i = 0; i < 5; i++) {
  await p.evaluate(() => window.UBSpiceSamples());
  await p.waitForTimeout(200);
  await p.locator('#modalBody .scard').nth(i).click();
  await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const S = window.UBSim.state, st = window.UniBoard.state;
    const erc = window.CADCore.erc(st.doc, window.CADCore.extractNets(st.doc)).map(m => m.t);
    return { log: S.log.map(m => m.lv + ':' + m.t), probes: S.probes.map(p => p.name), type: S.res && S.res.type, erc };
  });
  console.log('#' + i, JSON.stringify(r));
  await p.screenshot({ path: OUT + '/s' + i + '.png' });
}
console.log('ERR', errs.join('\n') || 'none');
await b.close();
