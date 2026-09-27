// APK 内と同じ条件 (https://appassets.androidplatform.net/ の仮想オリジン + AndroidBridge) で動作確認
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
import fs from 'node:fs'; import { execSync } from 'node:child_process';
const OUT = process.env.SHOTS || '/tmp';
const html = execSync('unzip -p dist/UniBoardSPICE.apk assets/index.html').toString();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36 wv' });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { window.__saved = []; window.AndroidBridge = { saveFile: (n, m, d) => window.__saved.push({ n, m, len: d.length, head: d.slice(0, 8) }), platform: () => 'android' }; });
await p.route('https://appassets.androidplatform.net/**', r => r.fulfill({ contentType: 'text/html', body: html }));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('https://appassets.androidplatform.net/index.html'); await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + '/and-1.png' });
const res = {};
res.android = await p.evaluate(() => document.documentElement.classList.contains('android'));
// シミュレーション (ワーカー) が動くか
await p.evaluate(() => { window.UBSim.state.cfg.type = 'tran'; window.UBSim.state.cfg.tstop = ''; });
await p.evaluate(() => window.UBSim.run()); await p.waitForTimeout(2500);
res.sim = await p.evaluate(() => window.UBSim.state.log.map(m => m.t));
res.worker = await p.evaluate(() => typeof Worker);
await p.screenshot({ path: OUT + '/and-2.png' });
// 保存 (ガーバー ZIP / 回路図 JSON) が AndroidBridge に渡るか
await p.evaluate(() => window.UBPcb.activate(true)); await p.waitForTimeout(400);
await p.evaluate(() => window.UniBoard.api.saveFile('board-gerber.zip', window.UBPcb.zip(window.UBPcb.gerberFiles())));
await p.evaluate(() => window.UniBoard.api.saveFile('schematic.json', window.CADDoc.serialize(window.UniBoard.state.doc)));
await p.waitForTimeout(300);
res.saved = await p.evaluate(() => window.__saved);
await p.screenshot({ path: OUT + '/and-3.png' });
// 戻るボタン: PCB → 回路図 → ドック → 終了
const back = []; for (let i = 0; i < 6; i++) back.push(await p.evaluate(() => window.UBAndroidBack()));
res.back = back;
console.log(JSON.stringify(res, null, 1)); console.log('ERR', errs.join('\n') || 'none');
await b.close();
