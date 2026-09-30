/* =====================================================================
   UniBoard SPICE — 表示スタイルの判定 (描画より前に実行)
   Web 版も Android アプリと同じ Material Design 3 の見た目 (html.md) にする。
   旧デザインは URL に ?ui=classic を付けたときだけ (Android では使えない)
   ===================================================================== */
(function () {
  var d = document.documentElement;
  var app = !!window.AndroidBridge;
  if (app) d.classList.add('android');
  var android = app || /Android/i.test(navigator.userAgent || '');
  var classic = !android && /[?&]ui=classic\b/.test(location.search);
  try { localStorage.removeItem('ubspice.ui'); } catch (e) { }
  if (!classic) d.classList.add('md');
})();
