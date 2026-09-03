import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL || 'postgres://localhost:5432/jc_command_center';
const isLocal = /@?(localhost|127\.0\.0\.1)/.test(url);
const declaresSsl = /[?&]sslmode=/.test(url);

/* SSL, three cases:
   - localhost: none.
   - URL already says sslmode (Neon, Supabase): leave it alone. pg parses it and
     sets the SNI servername from the host, which Neon needs to route at all.
   - URL says nothing but the host is remote (Render's internal URL): turn TLS on
     and skip verification, since those certs are not in the Node trust store.
     Still encrypted, just unverified. */
const ssl = isLocal ? false : declaresSsl ? undefined : { rejectUnauthorized: false };

export const pool = new pg.Pool({
  connectionString: url,
  ...(ssl === undefined ? {} : { ssl }),
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 15000
});

pool.on('error', err => console.error('Unexpected Postgres pool error', err));

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;
