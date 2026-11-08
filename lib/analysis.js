const { CHECKLIST, SITES } = require('./design');
const { IUIPC8, CUES, SITE_RATINGS, TLX } = require('./scales');

// ---------- helpers ----------
function truncateIp(ip) {
  if (!ip) return null;
  ip = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip.split('.').slice(0, 3).join('.') + '.0/24';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::/48';
  return null;
}

function parseUA(ua) {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  return `${browser} on ${os}`;
}

// Inverse standard normal CDF (Acklam's approximation).
function qnorm(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

const mean = (xs) => { const v = xs.filter((x) => typeof x === 'number' && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const round = (x, d = 3) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);

// What a page ACTUALLY collected (trackers can be blocked by ad-blockers).
function actual(page) {
  const t = page.trackers || {};
  const an = !!(t.analytics && t.analytics.received), fp = !!(t.fingerprint && t.fingerprint.received), px = !!(t.pixel && t.pixel.received);
  const truth = {
    time_scroll: an, screen: fp, timezone_lang: fp, gpu: fp && !!(t.fingerprint.webgl || t.fingerprint.deleted),
    browser_os: px || fp, contacts: false, gps: false, history: false, passwords: false, files: false,
  };
  return { analytics: an, fingerprint: fp, pixel: px, any: an || fp || px, truth };
}

// ---------- participant reveal ----------
function revealFor(p) {
  const pages = p.pages.map((pg) => {
    const a = actual(pg); const t = pg.trackers || {}; const ans = pg.answers || {};
    const collected = [];
    if (t.analytics && !t.analytics.deleted && t.analytics.received)
      collected.push(['Time on page', `${t.analytics.seconds} seconds`], ['How far you scrolled', `${t.analytics.maxScroll}%`],
        ['Clicks / pointer movements', `${t.analytics.clicks} / ${t.analytics.pointerMoves}`], ['Window size', t.analytics.viewport]);
    if (t.fingerprint && !t.fingerprint.deleted && t.fingerprint.received) {
      const f = t.fingerprint;
      collected.push(['Screen', `${f.screen} at ${f.pixelRatio}x`], ['Timezone', f.timezone], ['Language', f.languages || f.language],
        ['Graphics card', f.webgl ? f.webgl.renderer : 'not available'], ['CPU cores / memory', `${f.cpuCores || '?'} cores, ${f.memoryGB ? f.memoryGB + ' GB' : 'memory hidden'}`],
        ['Fonts your browser reports', (f.fonts || []).join(', ') || 'none'], ['Canvas fingerprint', f.canvasHash], ['Audio fingerprint', f.audioHash || 'blocked']);
    }
    if (t.pixel && !t.pixel.deleted && t.pixel.received)
      collected.push(['Browser and system', parseUA(t.pixel.userAgent)], ['Network address (shortened)', t.pixel.ipPrefix]);
    const blocked = pg.tracked && !a.any;
    return {
      position: pg.position, site: pg.site, banner: pg.banner, tracked: pg.tracked, actuallyTracked: a.any, blocked,
      partialBlock: pg.tracked && a.any && !(a.analytics && a.fingerprint && a.pixel),
      bannerAction: pg.bannerAction ? pg.bannerAction.action : (pg.banner ? 'ignored' : null),
      believedTracked: ans.believedTracked, confidence: ans.confidence,
      judgedCorrectly: ans.believedTracked ? (ans.believedTracked === 'yes') === a.any : null,
      checklist: CHECKLIST.map((c) => ({ label: c.label, ticked: !!(ans.checklist && ans.checklist[c.id]), truth: a.truth[c.id] })),
      collected,
    };
  });
  return { pages, correctCount: pages.filter((x) => x.judgedCorrectly).length, deleted: p.behaviour.deviceDataDeleted };
}

// ---------- trial-level rows ----------
function trials(all) {
  const rows = [];
  all.forEach((p) => p.pages.forEach((pg) => {
    if (!pg.answers) return;
    const a = actual(pg); const ans = pg.answers;
    const hits = CHECKLIST.filter((c) => a.truth[c.id] && ans.checklist[c.id]).length;
    const nTrue = CHECKLIST.filter((c) => a.truth[c.id]).length;
    const fas = CHECKLIST.filter((c) => !a.truth[c.id] && ans.checklist[c.id]).length;
    const row = {
      pid: p.pid, order: p.order, field: p.field, ageRange: p.ageRange, position: pg.position, site: pg.site,
      condition: pg.condition, banner: pg.banner ? 1 : 0, tracked_assigned: pg.tracked ? 1 : 0, tracked_actual: a.any ? 1 : 0,
      analytics_received: a.analytics ? 1 : 0, fingerprint_received: a.fingerprint ? 1 : 0, pixel_received: a.pixel ? 1 : 0,
      banner_action: pg.banner ? (pg.bannerAction ? pg.bannerAction.action : 'ignored') : '',
      believed_tracked: ans.believedTracked === 'yes' ? 1 : 0, confidence: ans.confidence,
      banner_decision_ms: pg.bannerAction && pg.bannerAction.msSinceLoad != null ? pg.bannerAction.msSinceLoad : '',
      effort_paas: ans.effort ?? '', trust: (ans.ratings || {}).trust ?? '', transparency: (ans.ratings || {}).transparency ?? '',
      control: (ans.ratings || {}).control ?? '', answer_ms: ans.answerMs ?? '', pick: ans.pick,
      checklist_hits: hits, checklist_true_items: nTrue, checklist_false_alarms: fas,
      checklist_decoy_items: CHECKLIST.length - nTrue,
      // ticks on the 5 items no page ever collects (contacts, GPS, history, passwords, files)
      checklist_impossible_ticks: CHECKLIST.filter((c) => !c.truth && ans.checklist[c.id]).length,
      seconds_on_page: pg.trackers.analytics && pg.trackers.analytics.seconds != null ? pg.trackers.analytics.seconds : '',
    };
    CHECKLIST.forEach((c) => (row['ck_' + c.id] = ans.checklist[c.id]));
    rows.push(row);
  }));
  return rows;
}

function participantRow(p) {
  const ts = trials([p]);
  const T = ts.filter((r) => r.tracked_actual), N = ts.filter((r) => !r.tracked_actual);
  let dprime = null, crit = null;
  if (ts.length === 4 && T.length && N.length) {
    const H = (T.filter((r) => r.believed_tracked).length + 0.5) / (T.length + 1);
    const F = (N.filter((r) => r.believed_tracked).length + 0.5) / (N.length + 1);
    dprime = qnorm(H) - qnorm(F); crit = -0.5 * (qnorm(H) + qnorm(F));
  }
  const yes = (f) => mean(ts.filter(f).map((r) => r.believed_tracked));
  const f = p.final || {}, r = p.reaction || {};
  const row = {
    pid: p.pid, order: p.order, field: p.field, ageRange: p.ageRange, device: p.deviceSelfReport,
    trials_done: ts.length, completed: p.completedAt ? 1 : 0,
    yes_rate_banner: round(yes((x) => x.banner)), yes_rate_nobanner: round(yes((x) => !x.banner)),
    yes_rate_tracked: round(yes((x) => x.tracked_actual)), yes_rate_untracked: round(yes((x) => !x.tracked_actual)),
    dprime: round(dprime), criterion_c: round(crit),
    tlx_raw: round(mean(TLX.map((x) => (f.tlx || {})[x.id])), 1) ?? '',
    effort_banner: round(mean(ts.filter((x) => x.banner).map((x) => x.effort_paas))), effort_nobanner: round(mean(ts.filter((x) => !x.banner).map((x) => x.effort_paas))),
    knowledge_score: f.knowledgeScore != null ? f.knowledgeScore : '',
    iuipc_mean: round(mean(IUIPC8.map((i) => (f.iuipc || {})[i.id]))),
    privacy_tools: f.privacyTools || '', cues: (f.cues || []).join('|'),
    surprise: r.surprise || '', concern: r.concern || '', assumed_protection: r.assumedProtection || '',
    deleted_device_data: p.behaviour.deviceDataDeleted ? 1 : 0, opened_tips: p.behaviour.tipsOpened ? 1 : 0,
    how_decided: f.howDecided || '', feeling: r.feeling || '',
    started_at: p.createdAt, completed_at: p.completedAt || '',
  };
  IUIPC8.forEach((i) => (row['iuipc_' + i.id] = (f.iuipc || {})[i.id] ?? ''));
  TLX.forEach((x) => (row['tlx_' + x.id] = (f.tlx || {})[x.id] ?? ''));
  return row;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';
}

// ---------- dashboard summary ----------
function summary(all) {
  const ts = trials(all);
  const full = all.filter((p) => p.pages.every((pg) => pg.answers));
  const fullIds = new Set(full.map((p) => p.pid));
  const fts = ts.filter((r) => fullIds.has(r.pid));
  const cells = {};
  ['B0T0', 'B0T1', 'B1T0', 'B1T1'].forEach((code) => {
    const rs = fts.filter((r) => r.condition === code);
    cells[code] = { n: rs.length, yesRate: round(mean(rs.map((r) => r.believed_tracked))), meanConfidence: round(mean(rs.map((r) => r.confidence)), 1),
      checklistHitRate: round(mean(rs.filter((r) => r.checklist_true_items).map((r) => r.checklist_hits / r.checklist_true_items))),
      checklistFalseAlarmRate: round(mean(rs.map((r) => r.checklist_false_alarms / r.checklist_decoy_items))),
      blockedPages: rs.filter((r) => r.tracked_assigned && !r.tracked_actual).length,
      meanEffort: round(mean(rs.map((r) => (r.effort_paas === '' ? null : r.effort_paas))), 2),
      meanTrust: round(mean(rs.map((r) => (r.trust === '' ? null : r.trust))), 2),
      meanTransparency: round(mean(rs.map((r) => (r.transparency === '' ? null : r.transparency))), 2),
      meanControl: round(mean(rs.map((r) => (r.control === '' ? null : r.control))), 2),
      medianAnswerSec: (() => { const v = rs.map((r) => r.answer_ms).filter((x) => x !== '').sort((a, b) => a - b); return v.length ? round(v[Math.floor(v.length / 2)] / 1000, 1) : null; })() };
  });
  const prs = full.map(participantRow);
  const diff = (a, b) => round(mean(prs.map((r) => (r[a] != null && r[b] != null ? r[a] - r[b] : null))));
  const first = {};
  ['B0T0', 'B0T1', 'B1T0', 'B1T1'].forEach((code) => {
    const rs = ts.filter((r) => r.position === 1 && r.condition === code);
    first[code] = { n: rs.length, yesRate: round(mean(rs.map((r) => r.believed_tracked))) };
  });
  const count = (arr) => arr.reduce((o, k) => ((o[k || '(blank)'] = (o[k || '(blank)'] || 0) + 1), o), {});
  const assignedTracked = ts.filter((r) => r.tracked_assigned);
  const completed = all.filter((p) => p.completedAt);
  return {
    n: { started: all.length, allFourSites: full.length, completed: completed.length },
    byOrder: count(all.map((p) => p.order)), byField: count(full.map((p) => p.field)),
    cells,
    withinPerson: { bannerEffectOnYes: diff('yes_rate_banner', 'yes_rate_nobanner'),
      trackingEffectOnYes: diff('yes_rate_tracked', 'yes_rate_untracked'),
      meanDprime: round(mean(prs.map((r) => r.dprime))), meanCriterion: round(mean(prs.map((r) => r.criterion_c))) },
    firstPageOnly: first,
    bannerActions: count(ts.filter((r) => r.banner).map((r) => r.banner_action)),
    rejectedButTracked: ts.filter((r) => r.condition === 'B1T1' && r.banner_action === 'reject').length,
    trackerDelivery: { pages: assignedTracked.length,
      analytics: round(mean(assignedTracked.map((r) => r.analytics_received))),
      fingerprint: round(mean(assignedTracked.map((r) => r.fingerprint_received))),
      pixel: round(mean(assignedTracked.map((r) => r.pixel_received))) },
    knowledgeMean: round(mean(prs.map((r) => (r.knowledge_score === '' ? null : r.knowledge_score))), 2),
    iuipcMean: round(mean(prs.map((r) => r.iuipc_mean)), 2),
    tlx: TLX.map((x) => ({ id: x.id, mean: round(mean(full.map((p) => p.final && p.final.tlx ? p.final.tlx[x.id] : null)), 1) })),
    tlxRaw: round(mean(prs.map((r) => (r.tlx_raw === '' ? null : r.tlx_raw))), 1),
    bannerDecisionSecMedian: (() => { const v = ts.filter((r) => r.banner_decision_ms !== '').map((r) => r.banner_decision_ms).sort((a, b) => a - b); return v.length ? round(v[Math.floor(v.length / 2)] / 1000, 1) : null; })(),
    cues: CUES.map((c) => ({ label: c.label, count: full.filter((p) => p.final && p.final.cues.includes(c.id)).length })),
    reaction: { surprise: round(mean(completed.map((p) => p.reaction.surprise)), 2), concern: round(mean(completed.map((p) => p.reaction.concern)), 2),
      assumedProtection: count(completed.map((p) => p.reaction.assumedProtection)) },
    behaviour: { deletedDeviceData: completed.filter((p) => p.behaviour.deviceDataDeleted).length,
      openedTips: completed.filter((p) => p.behaviour.tipsOpened).length },
    quotes: all.filter((p) => p.final || p.reaction).map((p) => ({ field: p.field,
      howDecided: p.final ? p.final.howDecided : '', feeling: p.reaction ? p.reaction.feeling : '' }))
      .filter((q) => q.howDecided || q.feeling),
  };
}

module.exports = {
  truncateIp, parseUA, revealFor, summary, actual,
  trialsCsv: (all) => toCsv(trials(all)),
  participantsCsv: (all) => toCsv(all.map(participantRow)),
};
