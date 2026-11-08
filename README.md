# Beyond the Banner — experiment app (v2)

A 2 × 2 within-subjects experiment with 20 participants. Each participant reads four fictional Karachi review websites.
Across the four sites, a cookie banner is shown or not, and real tracking runs or not
(order counterbalanced with a balanced Latin square). After each site they say whether they
think it recorded data about them and tick which data types it collected. At the end they see
exactly what was collected from their own visit.

## What is measured on each website
- Belief: "did this website record information about you?" (yes/no + confidence) and a 10-item data checklist
- HCI constructs (1–7): trust, transparency (visibility of system status), perceived control (user control and freedom)
- Cognitive load: Paas mental-effort rating (1–9), time to click the banner, time spent answering
- After all four websites: NASA-TLX (raw), decision cues, tracking knowledge, IUIPC-8

## Run locally
```bash
npm install
RESULTS_PASSWORD=choose-one npm start      # http://localhost:3000
```
Results dashboard: `http://localhost:3000/results` (any username, the password above).

Test the whole pipeline with fake participants (local only, never on the live study):
```bash
BASE=http://localhost:3000 N=20 npm run simulate
```
Then delete `data/db.json` before real data collection.

## Deploy on Render
1. Push this folder to GitHub. Create a **Web Service**: build `npm install`, start `npm start`.
2. Environment variables:
   - `RESULTS_PASSWORD` — required.
   - `DATABASE_URL` — **strongly recommended**. Render's free web-service disk is wiped on
     every restart/redeploy, so without a database you can lose responses. Any Postgres works
     (e.g. a free Neon or Supabase database). The app creates its own table.
3. Keep UptimeRobot pinging `/healthz`.

## Before collecting real data
- [ ] Replace the IUIPC-8 wording in `lib/scales.js` with the exact published items (Groß, PoPETs 2021) and set `IUIPC8_VERIFIED = true`.
- [ ] Get ethics approval (the study uses deception and collects device data).
- [ ] Pilot with 3–5 people on phones and laptops; check `/results` shows tracker delivery near 100% on tracked pages.
- [ ] Delete `data/db.json` (or empty the database table) after piloting.

## Files
| Path | What it is |
|---|---|
| `server.js` | Routes for the participant flow, trackers, and researcher pages |
| `lib/design.js` | Conditions, Latin square, checklist, the four site texts |
| `lib/scales.js` | Knowledge quiz (custom), IUIPC-8 (verify!), decision cues |
| `lib/analysis.js` | Reveal data, dashboard summary, CSV exports |
| `public/c/a.js` | Behavioural analytics (time, scroll, clicks) — tracked pages only |
| `public/c/d.js` | Stateless fingerprinting (canvas, WebGL, audio, fonts, screen, timezone) — tracked pages only |
| `/c/px.gif` | 1×1 pixel logging user-agent, language and a truncated IP prefix — tracked pages only |
| `views/*.html` | Consent, site template, banner, questions, final survey, reveal, results |
| `public/css/ui.css`, `public/js/ui.js` | Participant-facing design (one question per screen, big tap targets, Back/Next, progress). Does not touch the four stimulus websites or the cookie banner. |
| `analysis/analyze.py` | Pre-registered analysis on the exported CSVs |
| `analysis/power_sim.py` | Simulation-based power analysis |

## Privacy design
- No cookies or browser storage are set anywhere; the participant ID travels in the URL.
- Untracked pages load no tracking code at all.
- IP addresses are stored only as a /24 (IPv4) or /48 (IPv6) prefix.
- Participants can delete collected device data or withdraw entirely from the reveal page.
