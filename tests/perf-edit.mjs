// 蛇の目基板の手動調整: 部品のドラッグ移動・回転・元に戻す で配線が引き直されるか
import { createRequire } from 'node:module'; const { chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright');
const OUT = process.env.SHOTS || '/tmp';
const b = await chromium.launch();
let bad = 0;
const p = await b.newPage({ viewport: { width: 1280, height: 820 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await p.goto('file://' + process.cwd() + '/index.html'); await p.waitForTimeout(900);
await p.evaluate(() => { UniBoard.state.doc = CADDoc.loadSample(CADSamples[1]); UniBoard.api.refreshNets(); UniBoard.state.board = null; });
await p.click('.md-nav-it[data-for="tabPcb"]'); await p.waitForTimeout(200);
await p.click('#bConvert'); await p.waitForTimeout(200); await p.click('#modalFoot .btn.primary');
await p.waitForFunction(() => !UniBoard.state.busy && UniBoard.state.board, null, { timeout: 120000 });
await p.click('#zFit'); await p.waitForTimeout(300);
const info = () => p.evaluate(() => { const r = UniBoard.state.board; return { un: r.result.metrics.unrouted, pos: r.prj.comps.map(c => c.ref + '@' + c.pos.c + ',' + c.pos.r + ',' + c.pos.rot), probs: r.problems.filter(x => !/未接続/.test(x.t) || true).map(x => x.t), note: r.note, edited: !!r.edited }; });
const before = await info();
// 画面上の部品の位置 → マウスでドラッグ
const pick = await p.evaluate(() => {
  const r = UniBoard.state.board, st = UniBoard.state;
  // いちばん小さい 2 ピン部品 (抵抗など) を選ぶ
  const i = r.prj.comps.findIndex(c => c.nPads === 2 && !c.edge && !c.isPower);
  const c = r.prj.comps[i], s = c.rots[((c.pos.rot / 90) | 0) & 3];
  const cv = document.getElementById('cv').getBoundingClientRect();
  return { i, ref: c.ref, c: c.pos.c, r: c.pos.r, w: s.w, h: s.h };
});
const toScreen = (c, r) => p.evaluate(([c, r]) => { const cv = document.getElementById('cv').getBoundingClientRect(); const A = UniBoard.api; const inv = A.toW(0, 0), one = A.toW(1, 1); const z = 1 / (one[0] - inv[0]); return [cv.left + (c - inv[0]) * z, cv.top + (r - inv[1]) * z]; }, [c, r]);
const [sx, sy] = await toScreen(pick.c, pick.r);
// 空いている場所を探す
const target = await p.evaluate(i => { const E = UBPerfEdit, r = UniBoard.state.board, c = r.prj.comps[i];
  for (let d = 2; d < 12; d++) for (const [dc, dr] of [[0, d], [d, 0], [0, -d], [-d, 0], [d, d]]) { const q = { c: c.pos.c + dc, r: c.pos.r + dr, rot: c.pos.rot }; if (!E.check(i, q)) return q; } return null; }, pick.i);
const [tx, ty] = await toScreen(target.c, target.r);
await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 5 }); await p.mouse.move(tx, ty, { steps: 5 });
await p.screenshot({ path: OUT + '/pe-drag.png' });
await p.mouse.up(); await p.waitForTimeout(300);
const after = await info();
const moved = after.pos.find(x => x.startsWith(pick.ref + '@'));
console.log('drag', pick.ref, 'to', target, '->', moved, 'unrouted', after.un, after.note);
if (moved !== `${pick.ref}@${target.c},${target.r},${target.rot}`) { console.log('✗ 移動されていない'); bad++; }
if (!after.edited) { console.log('✗ 引き直しされていない'); bad++; }
const shorts = await p.evaluate(() => UniBoard.state.board.problems.filter(x => /ショート/.test(x.t)).length);
if (shorts) { console.log('✗ ショート', shorts); bad++; }
await p.screenshot({ path: OUT + '/pe-moved.png' });
// 回転 (R キー)
await p.keyboard.press('r'); await p.waitForTimeout(300);
const rot = await info();
console.log('rotate', rot.pos.find(x => x.startsWith(pick.ref + '@')), 'unrouted', rot.un);
if (rot.pos.find(x => x.startsWith(pick.ref + '@')) === moved) { console.log('✗ 回転されていない'); bad++; }
// 重なる場所へは置けない
const err = await p.evaluate(i => { const r = UniBoard.state.board; const o = r.prj.comps.find((c, k) => k !== i && !c.isPower); return UBPerfEdit.move(i, { c: o.pos.c, r: o.pos.r, rot: 0 }); }, pick.i);
console.log('overlap move ->', err); if (!err) { console.log('✗ 重なりを許した'); bad++; }
// 元に戻す 2 回で最初の位置へ
await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
const back = await info();
if (JSON.stringify(back.pos) !== JSON.stringify(before.pos)) { console.log('✗ 元に戻らない', back.pos.join(' ')); bad++; } else console.log('undo OK');
// 全部品を 1 つずつ動かしても配線が完成しているか
const all = await p.evaluate(() => { const r = UniBoard.state.board, out = []; r.prj.comps.forEach((c, i) => { for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const q = { c: c.pos.c + dc, r: c.pos.r + dr, rot: c.pos.rot }; if (!UBPerfEdit.check(i, q)) { UBPerfEdit.move(i, q); out.push(r.result.metrics.unrouted + (r.problems.some(x => /ショート/.test(x.t)) ? 's' : '')); break; } } }); return out; });
console.log('each part nudged → unrouted per move:', all.join(','));
if (all.some(x => /s/.test(String(x)))) { console.log('✗ ショートが出た'); bad++; }
console.log(errs.length ? 'JS エラー: ' + errs.join(' | ') : 'ERR none');
if (errs.length) bad++;
await b.close();
console.log(bad ? 'NG ' + bad : 'ALL PASS');
