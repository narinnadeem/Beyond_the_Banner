// Pushes simulated participants through the running app's real HTTP endpoints.
// Usage: BASE=http://localhost:3000 N=36 node scripts/simulate.js
// Simulated people believe they are tracked mostly when a banner is shown (the study hypothesis),
// so the dashboard and analysis script can be checked end to end. NEVER run against the live study.
const BASE = process.env.BASE || 'http://localhost:3000';
const N = Number(process.env.N || 20);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const post = (p, b, extra = {}) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(b) }).then((r) => r.json().catch(() => ({})));
const rnd = Math.random;

(async () => {
  for (let i = 0; i < N; i++) {
    const field = rnd() < 0.5 ? 'computing' : 'non_computing';
    const { next } = await post('/api/start', { consent: true, field, ageRange: '18-21', device: 'laptop_desktop' });
    const pid = next.split('/')[2];
    const blocker = rnd() < 0.1;
    for (let n = 1; n <= 4; n++) {
      const html = await (await fetch(`${BASE}/p/${pid}/site/${n}`, { headers: { 'User-Agent': UA } })).text();
      const banner = html.includes('id="cookie-banner"');
      const tracked = html.includes('/c/a.js');
      if (tracked && !blocker) {
        await fetch(`${BASE}/c/px.gif?p=${pid}&n=${n}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-PK,en;q=0.9,ur;q=0.8' } });
        await post('/c/e', { pid, n, seconds: 50 + Math.round(rnd() * 90), maxScroll: 60 + Math.round(rnd() * 40), clicks: 3, pointerMoves: 140, tabSwitches: 0, viewport: '1366x657' });
        await post('/c/d', { pid, n, screen: '1366x768', pixelRatio: 1, timezone: 'Asia/Karachi', language: 'en-US', languages: 'en-US,en,ur',
          cpuCores: 8, memoryGB: 8, canvasHash: 'a1b2c3d4', audioHash: '9f8e7d6c', webgl: { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620)' }, fonts: ['Arial', 'Calibri', 'Segoe UI'] });
      }
      if (banner) await post(`/api/p/${pid}/banner/${n}`, { action: rnd() < 0.55 ? 'accept' : 'reject', msSinceLoad: 2500 + Math.round(rnd() * 9000) });
      const pYes = (banner ? 0.75 : 0.3) + (tracked ? 0.05 : 0) + (field === 'computing' ? 0.1 : 0);
      const yes = rnd() < pYes;
      const checklist = yes ? ['time_scroll', 'screen', 'browser_os', rnd() < 0.4 ? 'gps' : 'timezone_lang', rnd() < 0.2 ? 'history' : 'gpu'] : [];
      const r7 = (base) => Math.max(1, Math.min(7, Math.round(base + (rnd() - 0.5) * 3)));
      await post(`/api/p/${pid}/q/${n}`, { pick: 'A', effort: Math.max(1, Math.min(9, Math.round((banner ? 5 : 4) + (rnd() - 0.5) * 4))),
        believedTracked: yes ? 'yes' : 'no', confidence: 1 + Math.floor(rnd() * 4), checklist,
        ratings: { trust: r7(banner ? 4.5 : 4), transparency: r7(banner ? 4.8 : 3), control: r7(banner ? 4.6 : 2.8) }, answerMs: 30000 + Math.round(rnd() * 40000) });
    }
    const knowledge = { k1: 'true', k2: 'true', k3: 'false', k4: 'dontknow', k5: 'false', k6: 'true', k7: 'true', k8: 'true' };
    const iuipc = { ctrl1: 6, ctrl2: 6, awa1: 7, awa2: 6, awa3: 7, coll1: 5, coll2: 5, coll3: 6 };
    const tlx = { mental: 55, physical: 10, temporal: 35, performance: 40, effort: 50, frustration: 30 };
    await post(`/api/p/${pid}/final`, { tlx, howDecided: 'If it showed a cookie notice I assumed it was collecting data.', cues: ['banner', 'design'], privacyTools: blocker ? 'yes' : 'no', knowledge, iuipc });
    await post(`/api/p/${pid}/reaction`, { surprise: 3 + Math.floor(rnd() * 3), concern: 2 + Math.floor(rnd() * 4), assumedProtection: 'never_thought', feeling: 'Did not expect the sites without a notice to collect anything.' });
    if (rnd() < 0.3) await post(`/api/p/${pid}/behaviour`, { action: 'delete_device_data' });
    if (rnd() < 0.5) await post(`/api/p/${pid}/behaviour`, { action: 'tips' });
  }
  console.log(`Simulated ${N} participants against ${BASE}`);
})();
