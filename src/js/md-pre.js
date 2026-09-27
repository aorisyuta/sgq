/* =====================================================================
   UniBoard SPICE — 表示スタイルの判定 (描画より前に実行)
   Android (アプリ / Android のブラウザ) では常に Material Design 3 の見た目 (html.md)。
   PC などでは ?ui=md / ?ui=classic または保存した設定で切り替えられる
   ===================================================================== */
(function () {
  var d = document.documentElement, pref = null;
  try { pref = localStorage.getItem('ubspice.ui'); } catch (e) { }
  var q = /[?&]ui=(md|classic)\b/.exec(location.search);
  if (q) { pref = q[1]; try { localStorage.setItem('ubspice.ui', pref); } catch (e) { } }
  var app = !!window.AndroidBridge;
  if (app) d.classList.add('android');
  var android = app || /Android/i.test(navigator.userAgent || '');
  if (android || pref === 'md') d.classList.add('md');
})();
