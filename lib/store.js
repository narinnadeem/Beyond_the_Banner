// Participant storage. One JSON document per participant.
// - If DATABASE_URL is set, documents are persisted to Postgres (recommended on Render,
//   whose free web-service disk is wiped on every restart/redeploy).
// - Otherwise they are written to data/db.json (fine for local testing only).
const fs = require('fs');
const path = require('path');

const cache = new Map();
let backend = 'file';
let pool = null;
const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');
let writeTimer = null;

async function init() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS participants (
      pid TEXT PRIMARY KEY, doc JSONB NOT NULL, updated_at TIMESTAMPTZ DEFAULT now())`);
    const { rows } = await pool.query('SELECT doc FROM participants');
    rows.forEach((r) => cache.set(r.doc.pid, r.doc));
    backend = 'postgres';
  } else {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    if (fs.existsSync(FILE)) {
      const arr = JSON.parse(fs.readFileSync(FILE, 'utf8') || '[]');
      arr.forEach((d) => cache.set(d.pid, d));
    }
    if (process.env.RENDER) {
      console.warn('WARNING: running on Render without DATABASE_URL. Data will be LOST on restart.');
    }
  }
  console.log(`Store: ${backend}, ${cache.size} participants loaded`);
}

function flushFile() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify([...cache.values()], null, 1));
    fs.renameSync(tmp, FILE);
  }, 200);
}

async function save(doc) {
  doc.updatedAt = new Date().toISOString();
  cache.set(doc.pid, doc);
  if (backend === 'postgres') {
    await pool.query(
      `INSERT INTO participants (pid, doc, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (pid) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
      [doc.pid, doc]
    );
  } else flushFile();
}

async function remove(pid) {
  cache.delete(pid);
  if (backend === 'postgres') await pool.query('DELETE FROM participants WHERE pid = $1', [pid]);
  else flushFile();
}

const get = (pid) => cache.get(pid);
const all = () => [...cache.values()];
const info = () => ({ backend, count: cache.size });

module.exports = { init, save, remove, get, all, info };
