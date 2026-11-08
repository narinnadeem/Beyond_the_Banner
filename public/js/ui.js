/* Shared helpers for the participant screens. No cookies / storage used (see README privacy design). */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Mark the label of every checked radio/checkbox with .on (works in all browsers, no :has needed).
  function syncAll() {
    document.querySelectorAll('label input[type=radio], label input[type=checkbox]').forEach(function (i) {
      var l = i.closest('label'); if (l) l.classList.toggle('on', i.checked);
    });
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.matches || !t.matches('input[type=radio], input[type=checkbox]')) return;
    if (t.type === 'radio' && t.name) {
      document.querySelectorAll('input[type=radio]').forEach(function (r) {
        if (r.name === t.name) { var l = r.closest('label'); if (l) l.classList.toggle('on', r.checked); }
      });
    } else { var l = t.closest('label'); if (l) l.classList.toggle('on', t.checked); }
  });

  // Wizard: shows one .step at a time with Back / Next, a progress bar, optional auto-advance on single-choice steps.
  //   o.root       element containing .step sections
  //   o.next/back  buttons
  //   o.err        element for validation messages (role=alert)
  //   o.bar        element whose <i> child is the progress fill
  //   o.label(i,n) -> string shown above the card
  //   o.validate(i, stepEl) -> '' when OK, otherwise a friendly message
  //   o.onFinish() called when Next is pressed on the last valid step
  function wizard(o) {
    var steps = Array.prototype.slice.call(o.root.querySelectorAll('.step')), i = 0, timer = null;
    function show(n, back) {
      i = n;
      steps.forEach(function (s, k) {
        s.hidden = k !== n;
        s.classList.remove('back');
        if (k === n && back) s.classList.add('back');
      });
      var last = n === steps.length - 1;
      o.next.textContent = last ? (o.finishLabel || 'Finish') : (n === 0 && o.firstLabel ? o.firstLabel : 'Next →');
      if (o.back) o.back.hidden = n === 0;
      if (o.bar) o.bar.firstElementChild.style.width = Math.round(((n + 1) / steps.length) * 100) + '%';
      if (o.label) o.label.textContent = o.stepText ? o.stepText(n, steps.length, steps[n]) : '';
      o.err.textContent = '';
      var h = steps[n].querySelector('.q-title, h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (o.onShow) o.onShow(n, steps[n]);
    }
    function next() {
      clearTimeout(timer);
      var m = o.validate ? o.validate(i, steps[i]) : '';
      if (m) { o.err.textContent = ''; void o.err.offsetWidth; o.err.textContent = m; return; }
      if (i === steps.length - 1) { o.onFinish(); return; }
      show(i + 1, false);
    }
    o.next.addEventListener('click', next);
    if (o.back) o.back.addEventListener('click', function () { clearTimeout(timer); if (i > 0) show(i - 1, true); });
    // Auto-advance after a single-choice answer (350 ms so the participant sees their selection). Back always works.
    o.root.addEventListener('change', function (e) {
      var st = e.target.closest && e.target.closest('.step');
      if (!st || steps[i] !== st || !st.hasAttribute('data-auto') || e.target.type !== 'radio' || i === steps.length - 1) return;
      clearTimeout(timer);
      timer = setTimeout(function () { if (steps[i] === st) next(); }, 350);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var t = e.target; if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      e.preventDefault(); next();
    });
    show(0, false);
    return { show: show, next: next, get index() { return i; } };
  }

  // Slider that must be touched once to count as answered.
  function initSliders(root) {
    (root || document).querySelectorAll('.slider').forEach(function (w) {
      var el = w.querySelector('input[type=range]'), out = w.querySelector('output');
      function set() { el.dataset.touched = '1'; w.classList.add('set'); el.style.setProperty('--pct', el.value + '%'); out.textContent = el.value; }
      ['input', 'change', 'pointerup', 'keydown'].forEach(function (ev) { el.addEventListener(ev, set); });
    });
  }

  window.UI = { esc: esc, syncAll: syncAll, wizard: wizard, initSliders: initSliders };
})();
