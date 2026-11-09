import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = process.env.SYNCH_DB || resolve(root, 'data', 'synch.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 15000;');

/** Conexão separada para trabalhos longos (importação da base CNPJ), para não travar as buscas. */
export function openConnection() {
  const c = new DatabaseSync(DB_PATH);
  c.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 15000; PRAGMA synchronous = NORMAL;');
  return c;
}

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 25,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE,
  osm_id TEXT UNIQUE,
  name TEXT NOT NULL,
  niche TEXT,
  category TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  lat REAL,
  lon REAL,
  phone TEXT,
  phone_kind TEXT,
  website TEXT,
  instagram TEXT,
  rating REAL,
  reviews INTEGER,
  photos INTEGER,
  has_hours INTEGER,
  price_level INTEGER,
  business_status TEXT,
  maps_url TEXT,
  chain INTEGER NOT NULL DEFAULT 0,
  sources TEXT NOT NULL DEFAULT '[]',
  audit TEXT,
  audited_at TEXT,
  features TEXT,
  score INTEGER,
  probability REAL,
  temperature TEXT,
  pain TEXT,
  explanation TEXT,
  competitor_share REAL,
  status TEXT NOT NULL DEFAULT 'novo',
  owner TEXT,
  notes TEXT NOT NULL DEFAULT '',
  next_action_at TEXT,
  contacted_at TEXT,
  closed_at TEXT,
  deal_value REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_biz_score ON businesses(score DESC);
CREATE INDEX IF NOT EXISTS idx_biz_status ON businesses(status);
CREATE INDEX IF NOT EXISTS idx_biz_owner ON businesses(owner);

CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  neighborhood TEXT,
  niches TEXT NOT NULL,
  radius_km REAL NOT NULL,
  lat REAL,
  lon REAL,
  sources TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'running',
  stage TEXT,
  error TEXT,
  found INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS search_results (
  search_id INTEGER NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  PRIMARY KEY (search_id, business_id)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  who TEXT,
  type TEXT NOT NULL,
  detail TEXT,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_biz ON events(business_id, at DESC);

CREATE TABLE IF NOT EXISTS cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  at INTEGER NOT NULL
);
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

export function cacheGet(key, maxAgeMs) {
  const row = db.prepare('SELECT value, at FROM cache WHERE key = ?').get(key);
  if (!row || Date.now() - row.at > maxAgeMs) return null;
  return JSON.parse(row.value);
}

export function cacheSet(key, value) {
  db.prepare('INSERT INTO cache(key, value, at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, at = excluded.at')
    .run(key, JSON.stringify(value), Date.now());
}

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---- migrações: colunas novas em bancos já existentes ----
function ensureColumns(table, cols) {
  const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
  for (const [name, type] of Object.entries(cols)) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}
ensureColumns('businesses', {
  cnpj: 'TEXT', email: 'TEXT', opened_at: 'TEXT', porte: 'TEXT', capital: 'REAL', mei: 'INTEGER',
  natureza: 'TEXT', phone_shared: 'INTEGER', website_derived: 'INTEGER',
});
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_biz_cnpj ON businesses(cnpj) WHERE cnpj IS NOT NULL');

// ---- Base CNPJ (Receita Federal) ----
db.exec(`
-- Agrupada por (UF, município, segmento): as empresas de uma cidade ficam juntas no disco,
-- então "dentistas de São Paulo" é uma leitura sequencial, não milhares de saltos.
CREATE TABLE IF NOT EXISTS rfb_estab (
  cnpj TEXT NOT NULL,
  basico TEXT NOT NULL,
  matriz INTEGER,
  fantasia TEXT,
  cnae TEXT,
  niche TEXT NOT NULL,
  inicio TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  bairro_norm TEXT,
  cep TEXT,
  uf TEXT NOT NULL,
  mun_cod TEXT NOT NULL,
  tel1 TEXT,
  tel2 TEXT,
  email TEXT,
  email_domain TEXT,
  PRIMARY KEY (uf, mun_cod, niche, cnpj)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_rfb_basico ON rfb_estab(basico);
CREATE TABLE IF NOT EXISTS rfb_empresa (basico TEXT PRIMARY KEY, razao TEXT, natureza TEXT, capital REAL, porte TEXT);
CREATE TABLE IF NOT EXISTS rfb_simples (basico TEXT PRIMARY KEY, mei INTEGER);
CREATE TABLE IF NOT EXISTS rfb_municipio (cod TEXT PRIMARY KEY, nome TEXT, norm TEXT);
CREATE INDEX IF NOT EXISTS idx_rfb_mun_norm ON rfb_municipio(norm);
CREATE TABLE IF NOT EXISTS rfb_domain_freq (domain TEXT PRIMARY KEY, n INTEGER);
CREATE TABLE IF NOT EXISTS rfb_phone_freq (phone TEXT PRIMARY KEY, n INTEGER);
`);
