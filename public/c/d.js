// Stateless device fingerprinting (loaded only on TRACKED pages). Sets no cookies or storage.
(function () {
  var s = document.currentScript;
  var pid = s.getAttribute('data-p'), n = s.getAttribute('data-n');

  function hash(str) { // FNV-1a 32-bit, hex
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  function canvasHash() {
    try {
      var c = document.createElement('canvas'); c.width = 240; c.height = 60;
      var x = c.getContext('2d');
      x.textBaseline = 'top'; x.font = '16px Arial'; x.fillStyle = '#f60'; x.fillRect(100, 5, 80, 30);
      x.fillStyle = '#069'; x.fillText('Beyond the banner 😀', 4, 10);
      x.fillStyle = 'rgba(102,204,0,0.7)'; x.fillText('Beyond the banner 😀', 6, 14);
      return hash(c.toDataURL());
    } catch (e) { return null; }
  }

  function webgl() {
    try {
      var c = document.createElement('canvas');
      var g = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!g) return null;
      var ext = g.getExtension('WEBGL_debug_renderer_info');
      return {
        vendor: ext ? g.getParameter(ext.UNMASKED_VENDOR_WEBGL) : g.getParameter(g.VENDOR),
        renderer: ext ? g.getParameter(ext.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER),
      };
    } catch (e) { return null; }
  }

  function audioHash() {
    return new Promise(function (resolve) {
      try {
        var AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!AC) return resolve(null);
        var ctx = new AC(1, 44100, 44100);
        var osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 10000;
        var comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -50; comp.knee.value = 40; comp.ratio.value = 12;
        comp.attack.value = 0; comp.release.value = 0.25;
        osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
        var done = false;
        setTimeout(function () { if (!done) resolve(null); }, 1500);
        ctx.startRendering().then(function (buf) {
          done = true; var d = buf.getChannelData(0), sum = 0;
          for (var i = 4500; i < 5000; i++) sum += Math.abs(d[i]);
          resolve(hash(sum.toString()));
        }).catch(function () { resolve(null); });
      } catch (e) { resolve(null); }
    });
  }

  function fonts() {
    var list = ['Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New', 'Georgia',
      'Helvetica', 'Helvetica Neue', 'Impact', 'Jameel Noori Nastaleeq', 'Lucida Console', 'Menlo', 'Monaco',
      'Noto Sans', 'Roboto', 'Segoe UI', 'SF Pro Text', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
      'Ubuntu', 'Verdana', 'Noto Nastaliq Urdu', 'Alvi Nastaleeq'];
    var bases = ['monospace', 'serif', 'sans-serif'];
    var c = document.createElement('canvas').getContext('2d'), txt = 'mmmmmmmmmlli10OQ';
    var w = {};
    bases.forEach(function (b) { c.font = '72px ' + b; w[b] = c.measureText(txt).width; });
    return list.filter(function (f) {
      return bases.some(function (b) { c.font = '72px "' + f + '",' + b; return c.measureText(txt).width !== w[b]; });
    });
  }

  audioHash().then(function (ah) {
    var tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    var payload = {
      pid: pid, n: n,
      screen: screen.width + 'x' + screen.height, availScreen: screen.availWidth + 'x' + screen.availHeight,
      pixelRatio: window.devicePixelRatio, colorDepth: screen.colorDepth,
      timezone: tz, tzOffsetMin: new Date().getTimezoneOffset(),
      language: navigator.language, languages: (navigator.languages || []).join(','),
      platform: navigator.platform, cpuCores: navigator.hardwareConcurrency || null,
      memoryGB: navigator.deviceMemory || null, touchPoints: navigator.maxTouchPoints || 0,
      doNotTrack: navigator.doNotTrack || null,
      canvasHash: canvasHash(), webgl: webgl(), audioHash: ah, fonts: fonts(),
    };
    fetch('/c/d', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), keepalive: true }).catch(function () {});
  });
})();
