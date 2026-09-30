// 「美しい配線」の効果: 同じ回路・同じ乱数で、オン/オフの GND 長・枝分かれ・ブロック混在・未配線を比べる
const G = require('./load.js');
const { CADDoc: CD, CADCore: C1, CADBoard: CB, CADSamples } = G;
const fs = require('fs'), path = require('path');
function run(doc, beauty, seed) {
  const nets = C1.extractNets(doc);
  const prj = CB.buildProject(doc, nets);
  const board = CB.autoBoardSize(prj, 'perf'); board.type = 'perf';
  CB.makePlacer(prj, board, { seed, beauty, crowdW: 2.5 }).finish();
  CB.compactBoard(prj, board, 2);
  const res = CB.routeAll(prj, board, { maxPass: 8, seed, reduceTop: 1000, chain: beauty, railsFirst: beauty, diagExtra: beauty ? 6 : 0 });
  if (!beauty) CB.functionalGroups(prj);
  const m = CB.beautyMetrics(prj, board, res);
  return { un: res.metrics.unrouted || 0, forced: res.metrics.forced, gnd: m.gndLen, len: m.totalLen, br: m.branches, mix: m.mix, blocks: m.blocks.length, area: board.cols * board.rows };
}
const docs = CADSamples.map(s => [s.name, CD.loadSample(s)]);
const ex = path.join(__dirname, '../examples/iraira-stick.json');
if (fs.existsSync(ex)) docs.push(['イライラ棒', CD.deserialize(fs.readFileSync(ex, 'utf8'))]);
const tot = { on: { gnd: 0, br: 0, mix: 0, un: 0, len: 0 }, off: { gnd: 0, br: 0, mix: 0, un: 0, len: 0 } };
let bad = 0;
for (const [name, doc] of docs) {
  const r = {};
  for (const b of [false, true]) {
    let best = null;
    for (const seed of [12345, 777, 4242, 99, 31337]) { const x = run(doc, b, seed); const sc = x.un * 1e6 + x.forced * 3000 + (b ? x.br * 250 + x.gnd * 4 + x.mix * 600 + x.len * 1.5 : 0) + x.len + x.area * 10; if (!best || sc < best.sc) best = Object.assign(x, { sc }); }
    r[b ? 'on' : 'off'] = best;
    const t = tot[b ? 'on' : 'off']; t.gnd += best.gnd; t.br += best.br; t.mix += best.mix; t.un += best.un; t.len += best.len;
  }
  const f = x => `GND ${x.gnd.toFixed(1)} 枝 ${x.br} 混在 ${x.mix} 未配線 ${x.un} 被覆 ${x.forced} 全長 ${x.len.toFixed(0)} (${x.blocks} ブロック)`;
  console.log(name.padEnd(24), '\n   従来:', f(r.off), '\n   美しい:', f(r.on));
  if (r.on.un > r.off.un) { console.log('   ✗ 未配線が増えた'); bad++; }
}
console.log('合計 従来', JSON.stringify(tot.off, (k, v) => typeof v === 'number' ? +v.toFixed(1) : v));
console.log('合計 美しい', JSON.stringify(tot.on, (k, v) => typeof v === 'number' ? +v.toFixed(1) : v));
if (tot.on.br > tot.off.br || tot.on.gnd > tot.off.gnd) { console.log('✗ 美しさが改善していない'); bad++; }
console.log(bad ? 'NG' : 'ALL PASS');
process.exit(bad ? 1 : 0);
