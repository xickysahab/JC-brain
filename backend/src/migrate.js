/* Applies schema.sql. Every statement is `if not exists`, so running it again
   after a new phase adds that phase's tables and leaves the rest alone.
   Run: npm run db:migrate */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './shared/db.js';

export async function applySchema() {
  const here = dirname(fileURLToPath(import.meta.url));
  await pool.query(await readFile(join(here, '..', 'schema.sql'), 'utf8'));
}

// Only run when invoked directly, not when setup.js imports it.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await applySchema();
  console.log('schema applied');
  await pool.end();
}
