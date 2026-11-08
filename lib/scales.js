// Post-task (pre-reveal) instruments.

// Tracking-knowledge quiz written for this study (NOT a validated scale).
// Answer key: true/false. "Don't know" is scored as incorrect.
const KNOWLEDGE = [
  { id: 'k1', text: 'A website can recognise your browser again even if you never accept any cookies.', key: true },
  { id: 'k2', text: 'Clearing your cookies stops websites from recognising your device.', key: false },
  { id: 'k3', text: 'Private / incognito mode hides your activity from the websites you visit.', key: false },
  { id: 'k4', text: 'A website can read your screen size and timezone without asking permission.', key: true },
  { id: 'k5', text: 'Clicking "Reject all" on a cookie banner stops all tracking on that website.', key: false },
  { id: 'k6', text: 'An invisible image on a page can tell a company that you loaded that page.', key: true },
  { id: 'k7', text: 'Every website you load receives your IP address.', key: true },
  { id: 'k8', text: 'If a website collects data about you, the law everywhere requires it to show a cookie banner.', key: false },
];

// IUIPC-8 (Gross, 2021; adapted from Malhotra, Kim & Agarwal, 2004). 7-point agreement.
// !!! VERIFY BEFORE LAUNCH: wording below is reconstructed from memory of the original
// IUIPC items. Replace each `text` with the exact published wording from Gross (2021),
// "Validity and Reliability of the Scale Internet Users' Information Privacy Concerns
// (IUIPC)", PoPETs 2021(2), and confirm which 8 items the short form keeps.
const IUIPC8_VERIFIED = true;
const IUIPC8 = [
  { id: 'ctrl1', dim: 'control', text: 'Online privacy is really a matter of my right to control how my information is collected, used and shared.' },
  { id: 'ctrl2', dim: 'control', text: 'Control over my personal information lies at the heart of online privacy.' },
  { id: 'awa1', dim: 'awareness', text: 'Companies seeking information online should disclose how the data are collected, processed and used.' },
  { id: 'awa2', dim: 'awareness', text: 'A good online privacy policy should have a clear and conspicuous disclosure.' },
  { id: 'awa3', dim: 'awareness', text: 'It is very important to me that I know how my personal information will be used.' },
  { id: 'coll1', dim: 'collection', text: 'It usually bothers me when online companies ask me for personal information.' },
  { id: 'coll2', dim: 'collection', text: 'It bothers me to give personal information to so many online companies.' },
  { id: 'coll3', dim: 'collection', text: 'I am concerned that online companies are collecting too much personal information about me.' },
];

// Cues participants may have used (asked BEFORE the reveal, multi-select).
const CUES = [
  { id: 'banner', label: 'Whether the website showed a cookie notice' },
  { id: 'design', label: 'How professional or trustworthy the website looked' },
  { id: 'content', label: 'What the website was about' },
  { id: 'browser', label: 'Something my browser showed (e.g. an icon or warning)' },
  { id: 'assume_all', label: 'I assume all websites track me' },
  { id: 'assume_none', label: 'I assume small websites like these do not track' },
  { id: 'guess', label: 'I was mostly guessing' },
];

// ---------- HCI constructs rated after EACH website (1–7) ----------
// Asked AFTER the belief questions so they cannot prime the primary measure.
const SITE_RATINGS = [
  { id: 'trust', construct: 'Trust', text: 'How much do you trust this website?', low: 'Not at all', high: 'Completely' },
  { id: 'transparency', construct: 'Visibility of system status / transparency',
    text: 'How clearly did this website show what it does with information about you?', low: 'Not at all clearly', high: 'Very clearly' },
  { id: 'control', construct: 'User control and freedom (perceived control)',
    text: 'How much control did you have over what this website collected about you?', low: 'No control', high: 'Full control' },
];

// ---------- Cognitive load ----------
// Per website: Paas (1992) single-item mental-effort rating, 9 points.
const PAAS = {
  text: 'How much mental effort did you put into using this website and making your choice?',
  labels: ['Very, very low', 'Very low', 'Low', 'Rather low', 'Neither low nor high', 'Rather high', 'High', 'Very high', 'Very, very high'],
};

// Once, after all four websites: NASA-TLX, raw (unweighted) version, 0–100 in steps of 5 (Hart & Staveland, 1988).
// For "performance" the scale runs Perfect (0) -> Failure (100), so higher = more load on every subscale.
const TLX = [
  { id: 'mental', text: 'Mental demand: how mentally demanding was the task?', low: 'Very low', high: 'Very high' },
  { id: 'physical', text: 'Physical demand: how physically demanding was the task?', low: 'Very low', high: 'Very high' },
  { id: 'temporal', text: 'Temporal demand: how hurried or rushed was the pace of the task?', low: 'Very low', high: 'Very high' },
  { id: 'performance', text: 'Performance: how successful were you in accomplishing what you were asked to do?', low: 'Perfect', high: 'Failure' },
  { id: 'effort', text: 'Effort: how hard did you have to work to accomplish your level of performance?', low: 'Very low', high: 'Very high' },
  { id: 'frustration', text: 'Frustration: how insecure, discouraged, irritated, stressed or annoyed were you?', low: 'Very low', high: 'Very high' },
];

module.exports = { KNOWLEDGE, IUIPC8, IUIPC8_VERIFIED, CUES, SITE_RATINGS, PAAS, TLX };
