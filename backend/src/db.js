import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL || 'postgres://localhost:5432/jc_command_center';
const isLocal = /@?(localhost|127\.0\.0\.1)/.test(url);

/* Managed Postgres (Render, Neon, Supabase) requires TLS and serves a cert the
   Node default trust store does not know. rejectUnauthorized:false is what those
   providers document; the connection is still encrypted. Local dev needs no TLS. */
export const pool = new pg.Pool({
  connectionString: url,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 10)
});

pool.on('error', err => console.error('Unexpected Postgres pool error', err));

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;
