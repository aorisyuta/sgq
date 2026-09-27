// base.html の DOM 非依存スクリプト (core 1, core 2, samples, doc) と追加 JS を node に読み込む
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/base.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
globalThis.window = undefined;
for (const s of scripts.slice(0, 4)) vm.runInThisContext(s);
for (const f of ['spice.js', 'spice-models.js', 'parts-symbols.js', 'parts-catalog.js', 'sim-netlist.js']) {
  const p = path.join(root, 'src/js', f);
  if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f });
}
module.exports = globalThis;
