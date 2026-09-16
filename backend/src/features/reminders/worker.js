import { many, one } from '../../shared/db.js';
import { dueReminders, reminderText, LEAD_MINUTES } from './due.js';
import { deliver, pushConfigured } from './send.js';

/* The loop that makes the attention engine audible.

   It runs inside the web process rather than as a second service: one machine,
   one deploy, and nothing to keep in sync. If this ever needs to outlive a
   single process, reminders_sent is already the lock that makes it safe to run
   twice. */

const EVERY_MS = 60_000;

export async function sweep(now = new Date()) {
  const rows = await many(
    `select t.id, t.user_id, t.title, t.status, t.priority, t.start_date, t.deadline,
            b.name as bucket
       from tasks t
       left join buckets b on b.id = t.bucket_id
      where t.status in ('Todo','In Progress')
        and coalesce(t.start_date, t.deadline) is not null
        and coalesce(t.start_date, t.deadline) between $1 and $2
        and not exists (select 1 from reminders_sent s where s.task_id = t.id and s.kind = 'due')`,
    [new Date(now.getTime() - 60 * 60_000), new Date(now.getTime() + (LEAD_MINUTES + 2) * 60_000)]
  );

  const due = dueReminders(rows, now);
  let sent = 0;
  for (const { task, kind } of due) {
    // Claim it first. If the insert loses a race the reminder was already
    // handled, and a duplicate notification is worse than a missing log line.
    const claim = await one(
      `insert into reminders_sent (task_id, kind) values ($1, $2)
       on conflict do nothing returning task_id`, [task.id, kind]
    );
    if (!claim) continue;
    const { sent: n } = await deliver(task.user_id, { ...reminderText(task, now), url: '/todo' });
    sent += n;
  }
  return { considered: rows.length, due: due.length, sent };
}

export function startReminderLoop() {
  if (!pushConfigured) {
    console.log('reminders: no VAPID keys, loop not started');
    return null;
  }
  const tick = () => sweep().catch(err => console.error('reminder sweep failed', err));
  tick();
  const timer = setInterval(tick, EVERY_MS);
  timer.unref?.();
  console.log('reminders: sweeping every 60s');
  return timer;
}
