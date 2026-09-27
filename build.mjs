// UniBoard SPICE — 1 ファイルの index.html を組み立てる
//   node build.mjs  →  index.html
import fs from 'node:fs';
const rd = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
let html = rd('./src/base.html');
const js = f => { const s = rd('./src/js/' + f); if (/<\/script/i.test(s)) throw new Error(f + ' contains </script'); return s; };
const tag = (f, worker) => `<script${worker ? ' data-worker' : ''}>\n/* ---- ${f} ---- */\n${js(f)}\n</script>\n`;
const css = rd('./src/css/app.css');
const one = (h, a, b) => { const i = h.indexOf(a); if (i < 0 || h.indexOf(a, i + 1) >= 0) throw new Error('marker: ' + a); return h.slice(0, i) + b + h.slice(i); };
// スタイル: 既存の <style> の後ろ
html = one(html, '</head>', `<style>\n${css}\n</style>\n`);
// エンジン・部品: 描画スクリプトの前
const renderMark = html.lastIndexOf('<script>', html.indexOf('UniBoard CAD — 描画 (Canvas / SVG 共通ペン)'));
html = html.slice(0, renderMark) + tag('ui-pre.js') + tag('spice.js', true) + tag('spice-models.js', true) + tag('parts-symbols.js') + tag('parts-catalog.js') + tag('sim-netlist.js') + html.slice(renderMark);
// 画面: アプリ本体の後ろ
html = one(html, '</body>', tag('simui.js') + tag('pcbx.js') + tag('perf-manual.js') + tag('calc.js') + tag('shell.js'));
fs.writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
