/* One-shot setup: creates the schema and the first admin user.
   Run: npm run db:setup -- admin@example.com "a-good-password" "Aagam" */
import 'dotenv/config';
import { pool, one } from './db.js';
import { applySchema } from './migrate.js';
import { hash, badPassword } from './auth.js';

const [email, password, name = 'Admin'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run db:setup -- <email> <password> [name]');
  process.exit(1);
}
const bad = badPassword(password);
if (bad) { console.error(bad); process.exit(1); }

await applySchema();
console.log('schema applied');

if (await one('select id from users where lower(email) = $1', [email.toLowerCase()])) {
  console.log(`user ${email} already exists - nothing else to do`);
} else {
  const account = await one('insert into accounts (name) values ($1) returning id', [`${name}'s workspace`]);
  await one(
    `insert into users (account_id, email, name, password_hash, role)
     values ($1,$2,$3,$4,'admin') returning id`,
    [account.id, email.toLowerCase(), name, await hash(password)]
  );
  console.log(`admin created: ${email}`);
}
await pool.end();
