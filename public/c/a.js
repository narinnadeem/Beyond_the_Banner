// Behavioural analytics (loaded only on TRACKED pages).
// Records time on page, maximum scroll depth, clicks, pointer movement and tab switches.
(function () {
  var s = document.currentScript;
  var pid = s.getAttribute('data-p'), n = s.getAttribute('data-n');
  var t0 = Date.now(), maxScroll = 0, clicks = 0, moves = 0, hidden = 0, sent = 0;

  function depth() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    return h <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / h) * 100));
  }
  window.addEventListener('scroll', function () { maxScroll = Math.max(maxScroll, depth()); }, { passive: true });
  document.addEventListener('click', function () { clicks++; });
  document.addEventListener('pointermove', function () { moves++; }, { passive: true });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { hidden++; send(); } });

  function send() {
    sent++;
    var body = JSON.stringify({
      pid: pid, n: n, seconds: Math.round((Date.now() - t0) / 1000),
      maxScroll: Math.max(maxScroll, depth()), clicks: clicks, pointerMoves: moves,
      tabSwitches: hidden, viewport: window.innerWidth + 'x' + window.innerHeight, beat: sent,
    });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon('/c/e', new Blob([body], { type: 'application/json' }));
      else fetch('/c/e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  }
  setInterval(send, 8000);
  window.addEventListener('pagehide', send);
  window.__flushA = send;
})();
