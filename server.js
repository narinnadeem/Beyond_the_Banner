const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const { SITES, CHECKLIST, ORDERS, conditionAt } = require('./lib/design');
const { KNOWLEDGE, IUIPC8, IUIPC8_VERIFIED, CUES, SITE_RATINGS, PAAS, TLX } = require('./lib/scales');
const analysis = require('./lib/analysis');

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '64kb', type: ['application/json', 'text/plain'] }));
app.use('/static', express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
// Trackers are served from a neutral path, with no caching so every load reaches the server.
app.use('/c', express.static(path.join(__dirname, 'public', 'c'), { maxAge: 0, etag: false }));

const VIEWS = path.join(__dirname, 'views');
const view = (name) => fs.readFileSync(path.join(VIEWS, name), 'utf8');
const UUID = /^[0-9a-f-]{36}$/;
const ADMIN_PASSWORD = process.env.RESULTS_PASSWORD || 'admin';
if (!process.env.RESULTS_PASSWORD) console.warn('WARNING: RESULTS_PASSWORD not set; using "admin".');

function participant(req, res) {
  const pid = req.params.pid;
  const p = UUID.test(pid || '') && store.get(pid);
  if (!p) { res.status(404).send('Session not found. Please restart from the study link.'); return null; }
  return p;
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Participant flow ----------
app.get('/', (req, res) => res.send(view('consent.html')));

app.post('/api/start', async (req, res) => {
  const { consent, field, ageRange, device } = req.body || {};
  if (consent !== true) return res.status(400).json({ error: 'Consent is required.' });
  const orderIndex = store.all().length % ORDERS.length; // round-robin over Latin-square rows
  const p = {
    pid: crypto.randomUUID(), createdAt: new Date().toISOString(), orderIndex,
    order: ORDERS[orderIndex].join(''), field: String(field || ''), ageRange: String(ageRange || ''),
    deviceSelfReport: String(device || ''),
    pages: SITES.map((s) => {
      const c = conditionAt(orderIndex, s.n);
      return { position: s.n, site: s.name, condition: c.code, banner: c.banner, tracked: c.tracked,
        bannerAction: null, trackers: { analytics: null, fingerprint: null, pixel: null }, answers: null };
    }),
    final: null, reaction: null, behaviour: { deviceDataDeleted: false, tipsOpened: false }, completedAt: null,
  };
  await store.save(p);
  res.json({ next: `/p/${p.pid}/site/1` });
});

app.get('/p/:pid/site/:n', (req, res) => {
  const p = participant(req, res); if (!p) return;
  const n = Number(req.params.n);
  const site = SITES.find((s) => s.n === n); const page = p.pages[n - 1];
  if (!site || !page) return res.status(404).send('Not found');
  const pidAttr = esc(p.pid);
  const trackers = page.tracked
    ? `<script src="/c/a.js" data-p="${pidAttr}" data-n="${n}"></script>
<script src="/c/d.js" data-p="${pidAttr}" data-n="${n}" async></script>
<img src="/c/px.gif?p=${pidAttr}&n=${n}&r=${Date.now()}" width="1" height="1" alt="" style="position:absolute;left:-9999px;top:0">`
    : '';
  const banner = page.banner ? view('banner.html') : '';
  const html = view('site.html')
    .replace(/{{SITE_NAME}}/g, esc(site.name)).replace('{{TAGLINE}}', esc(site.tagline))
    .replace('{{THEME}}', site.theme).replace('{{CATEGORY}}', esc(site.category))
    .replace(/{{TITLE}}/g, esc(site.title)).replace('{{BODY}}', site.body.map((b) => `<p>${b}</p>`).join('\n'))
    .replace('{{BANNER}}', banner).replace('{{TRACKERS}}', trackers)
    .replace('{{NEXT}}', `/p/${pidAttr}/q/${n}`).replace('{{STEP}}', String(n))
    .replace('{{BANNER_ENDPOINT}}', `/api/p/${pidAttr}/banner/${n}`);
  res.set('Cache-Control', 'no-store').send(html);
});

app.post('/api/p/:pid/banner/:n', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  const page = p.pages[Number(req.params.n) - 1];
  if (!page || !page.banner) return res.status(400).end();
  const ms = Number(req.body.msSinceLoad);
  if (!page.bannerAction) page.bannerAction = { action: String(req.body.action || ''), msSinceLoad: ms > 0 && ms < 36e5 ? Math.round(ms) : null, at: new Date().toISOString() };
  await store.save(p); res.json({ ok: true });
});

app.get('/p/:pid/q/:n', (req, res) => { if (participant(req, res)) res.send(view('questions.html')); });
app.get('/api/p/:pid/q/:n', (req, res) => {
  const p = participant(req, res); if (!p) return;
  const site = SITES.find((s) => s.n === Number(req.params.n)); if (!site) return res.status(404).end();
  // Checklist order is shuffled per participant+page so position effects average out.
  const key = (id) => crypto.createHash('md5').update(p.pid + ':' + site.n + ':' + id).digest('hex');
  const items = CHECKLIST.map((c) => ({ id: c.id, label: c.label, k: key(c.id) }))
    .sort((a, b) => (a.k < b.k ? -1 : 1)).map(({ id, label }) => ({ id, label }));
  res.json({ siteName: site.name, options: site.options, step: site.n, total: SITES.length, checklist: items,
    paas: PAAS, ratings: SITE_RATINGS.map(({ id, text, low, high }) => ({ id, text, low, high })) });
});

app.post('/api/p/:pid/q/:n', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  const n = Number(req.params.n); const page = p.pages[n - 1]; if (!page) return res.status(404).end();
  const b = req.body || {};
  if (!['yes', 'no'].includes(b.believedTracked)) return res.status(400).json({ error: 'Please answer whether the website recorded data.' });
  if (!page.answers) {
    page.answers = {
      pick: String(b.pick || ''), believedTracked: b.believedTracked,
      confidence: Number(b.confidence) || null,
      effort: Number(b.effort) >= 1 && Number(b.effort) <= 9 ? Number(b.effort) : null,
      ratings: SITE_RATINGS.reduce((o, r) => { const v = Number(b.ratings && b.ratings[r.id]); o[r.id] = v >= 1 && v <= 7 ? v : null; return o; }, {}),
      answerMs: Number(b.answerMs) > 0 ? Math.round(Number(b.answerMs)) : null,
      checklist: CHECKLIST.reduce((o, c) => ((o[c.id] = Array.isArray(b.checklist) && b.checklist.includes(c.id) ? 1 : 0), o), {}),
      sawNotice: ['yes', 'no', 'unsure'].includes(b.sawNotice) ? b.sawNotice : null,
      submittedAt: new Date().toISOString(),
    };
    await store.save(p);
  }
  res.json({ next: n < SITES.length ? `/p/${p.pid}/site/${n + 1}` : `/p/${p.pid}/final` });
});

app.get('/p/:pid/final', (req, res) => { if (participant(req, res)) res.send(view('final.html')); });
app.get('/api/scales', (req, res) => res.json({ knowledge: KNOWLEDGE.map(({ id, text }) => ({ id, text })), iuipc: IUIPC8, cues: CUES, tlx: TLX }));
app.post('/api/p/:pid/final', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  const b = req.body || {};
  if (!p.final) {
    const know = {}; let score = 0;
    KNOWLEDGE.forEach((k) => { const a = b.knowledge && b.knowledge[k.id]; know[k.id] = a || null;
      if ((a === 'true' && k.key) || (a === 'false' && !k.key)) score++; });
    const iuipc = {}; IUIPC8.forEach((i) => { const v = Number(b.iuipc && b.iuipc[i.id]); iuipc[i.id] = v >= 1 && v <= 7 ? v : null; });
    const tlx = {}; TLX.forEach((x) => { const v = Number(b.tlx && b.tlx[x.id]); tlx[x.id] = v >= 0 && v <= 100 ? v : null; });
    p.final = { tlx, howDecided: String(b.howDecided || '').slice(0, 2000),
      cues: Array.isArray(b.cues) ? b.cues.filter((c) => CUES.some((x) => x.id === c)) : [],
      privacyTools: String(b.privacyTools || ''), knowledge: know, knowledgeScore: score, iuipc,
      submittedAt: new Date().toISOString() };
    await store.save(p);
  }
  res.json({ next: `/p/${p.pid}/reveal` });
});

app.get('/p/:pid/reveal', (req, res) => { if (participant(req, res)) res.send(view('reveal.html')); });
app.get('/api/p/:pid/reveal', (req, res) => {
  const p = participant(req, res); if (!p) return;
  if (!p.final) return res.status(409).json({ error: 'Please finish the questions first.', next: `/p/${p.pid}/final` });
  res.json(analysis.revealFor(p));
});
app.post('/api/p/:pid/reaction', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  const b = req.body || {};
  if (!p.reaction) {
    p.reaction = { surprise: Number(b.surprise) || null, concern: Number(b.concern) || null,
      assumedProtection: String(b.assumedProtection || ''), feeling: String(b.feeling || '').slice(0, 2000),
      submittedAt: new Date().toISOString() };
    p.completedAt = new Date().toISOString();
    await store.save(p);
  }
  res.json({ ok: true });
});
app.post('/api/p/:pid/behaviour', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  const a = (req.body || {}).action;
  if (a === 'tips') p.behaviour.tipsOpened = true;
  if (a === 'delete_device_data') {
    p.behaviour.deviceDataDeleted = true;
    p.pages.forEach((pg) => { // keep only whether each tracker fired, drop the collected values
      ['analytics', 'fingerprint', 'pixel'].forEach((k) => { if (pg.trackers[k]) pg.trackers[k] = { received: true, deleted: true }; });
    });
  }
  await store.save(p); res.json({ ok: true });
});
app.post('/api/p/:pid/withdraw', async (req, res) => {
  const p = participant(req, res); if (!p) return;
  await store.remove(p.pid); res.json({ ok: true });
});

// ---------- Trackers (only ever requested from TRACKED pages) ----------
function trackerPage(pid, n) {
  const p = UUID.test(pid || '') && store.get(pid); if (!p) return null;
  const page = p.pages[Number(n) - 1]; if (!page || !page.tracked) return null;
  return { p, page };
}
app.post('/c/e', async (req, res) => {
  const b = req.body || {}; const t = trackerPage(b.pid, b.n);
  if (t && !t.p.behaviour.deviceDataDeleted) {
    const prev = t.page.trackers.analytics || {};
    t.page.trackers.analytics = { received: true, seconds: Math.max(prev.seconds || 0, Number(b.seconds) || 0),
      maxScroll: Math.max(prev.maxScroll || 0, Number(b.maxScroll) || 0), clicks: Number(b.clicks) || 0,
      pointerMoves: Number(b.pointerMoves) || 0, tabSwitches: Number(b.tabSwitches) || 0, viewport: String(b.viewport || '') };
    await store.save(t.p);
  }
  res.status(204).end();
});
app.post('/c/d', async (req, res) => {
  const b = req.body || {}; const t = trackerPage(b.pid, b.n);
  if (t && !t.p.behaviour.deviceDataDeleted) {
    const { pid, n, ...fp } = b;
    t.page.trackers.fingerprint = { received: true, ...fp };
    await store.save(t.p);
  }
  res.status(204).end();
});
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
app.get('/c/px.gif', async (req, res) => {
  const t = trackerPage(req.query.p, req.query.n);
  if (t && !t.p.behaviour.deviceDataDeleted) {
    t.page.trackers.pixel = { received: true, userAgent: String(req.get('user-agent') || ''),
      acceptLanguage: String(req.get('accept-language') || ''), ipPrefix: analysis.truncateIp(req.ip),
      at: new Date().toISOString() };
    await store.save(t.p);
  }
  res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, max-age=0' }).send(GIF);
});

// ---------- Researcher pages ----------
function adminAuth(req, res, next) {
  const [type, val] = (req.get('authorization') || '').split(' ');
  if (type === 'Basic' && val) {
    const pass = Buffer.from(val, 'base64').toString().split(':').slice(1).join(':');
    if (pass.length === ADMIN_PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pass), Buffer.from(ADMIN_PASSWORD))) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="results"').status(401).send('Password required');
}
app.get('/results', adminAuth, (req, res) => res.send(view('results.html')));
app.get('/results/summary.json', adminAuth, (req, res) =>
  res.json({ ...analysis.summary(store.all()), store: store.info(), iuipcVerified: IUIPC8_VERIFIED }));
app.get('/results/trials.csv', adminAuth, (req, res) => {
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="trials_long.csv"' });
  res.send(analysis.trialsCsv(store.all()));
});
app.get('/results/participants.csv', adminAuth, (req, res) => {
  res.set({ 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="participants.csv"' });
  res.send(analysis.participantsCsv(store.all()));
});
app.get('/results/raw.json', adminAuth, (req, res) => {
  res.set('Content-Disposition', 'attachment; filename="raw.json"'); res.json(store.all());
});
app.get('/healthz', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
store.init().then(() => app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`)))
  .catch((e) => { console.error(e); process.exit(1); });
