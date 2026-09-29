/* سلام صدر بویز — theme boot (sync, pre-paint; no FOUC) */
(function () {
  var t = null;
  try { t = localStorage.getItem('ssb-theme'); } catch (e) {}
  if (t !== 'light' && t !== 'dark') {
    try { t = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
    catch (e) { t = 'dark'; }
  }
  document.documentElement.setAttribute('data-theme', t);
})();
