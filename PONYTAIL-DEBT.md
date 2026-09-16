# Ponytail debt

Every deliberate shortcut in this codebase carries a `ponytail:` comment naming
what it gives up and what should trigger revisiting it. This file is those
comments collected in one place, so a deferral cannot quietly become permanent.

Regenerate with `/ponytail-debt`.

## Ledger

**backend/src/features/auth/throttle.js:5** — failed-login counts live in
process memory instead of a shared store.
*Ceiling:* correct for one instance; a second one simply doubles the allowance.
*Upgrade:* move to Redis or a table when the API runs on more than one box.

**backend/src/shared/score.js:55** — urgency scoring and sorting run in JS over
the whole result set rather than in SQL.
*Ceiling:* fine into the low thousands of tasks per user.
*Upgrade:* push into SQL if one user ever passes that.

**backend/src/features/stats/stats.js:61** — chart grouping runs in JS for the
same reason, which keeps one code path for every dimension including computed
ones.
*Ceiling:* the same low thousands.
*Upgrade:* push into SQL if one user ever holds tens of thousands of tasks.

**frontend/public/sw.js:25** — the offline cache serves reads only; a write made
without a connection fails and is the user's to retry.
*Ceiling:* no offline writes at all.
*Upgrade:* a replay queue, once there are conflict rules worth writing.

4 markers, 0 with no trigger.
