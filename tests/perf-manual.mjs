import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import fs from 'node:fs';
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + e.stack));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(1000);
await p.click('.md-more'); await p.click('.md-menu button:has-text("開く")'); await p.click('.pastebox summary');
await p.fill('.pastebox textarea', fs.readFileSync('examples/iraira-stick.json', 'utf8'));
await p.click('text=貼り付けた内容を読み込む'); await p.waitForTimeout(800);
const r = await p.evaluate(() => { const st = window.UniBoard.state, b = st.board;
  return { tab: st.tab, manual: b && b.manual, size: b && b.board.cols + 'x' + b.board.rows, m: b && b.result.metrics, problems: b && b.problems,
    wiring: window.CADBoard.wiringList(b.prj, b.board, b.result, null).slice(0, 6).map(w => w.text) }; });
console.log(JSON.stringify(r, null, 1));
await p.screenshot({ path: OUT + '/pm-top.png' });
await p.click('#vBot'); await p.waitForTimeout(200); await p.screenshot({ path: OUT + '/pm-bot.png' });
// 自動変換 → 配置を保存 → 読み直しても同じか
await p.click('.md-nav-it[data-for="tabSch"]'); await p.click('.md-nav-it[data-for="tabPcb"]'); await p.waitForTimeout(300);
const same = await p.evaluate(() => window.UniBoard.state.board.manual);
// ショート検出: 配線を1本わざと間違える
const bad = await p.evaluate(() => { const d = JSON.parse(window.CADDoc.serialize(window.UniBoard.state.doc)); d.perfboard.wires.push({ layer: 'solder', pts: ['B4', 'B6'] });
  const doc = window.CADDoc.deserialize(JSON.stringify(d)); return window.UBPerf.build(doc).problems.map(x => x.net + ': ' + x.t); });
console.log('stay manual after tab switch:', same, '\nintentional short ->', JSON.stringify(bad));
console.log('ERR', errs.join('\n') || 'none');
await b.close();
