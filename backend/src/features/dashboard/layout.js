/* Dashboard layout: shape, defaults and validation.
   Its own module so the rules are testable without a server or a browser, and
   so the client and the API cannot drift on what a widget looks like. */

/** Widget types the canvas can render. Kept here rather than inferred from the
    client so a layout cannot smuggle in a type the server has never heard of. */
const TYPES = ['clock', 'note', 'list', 'counter', 'chart', 'progress', 'calendar', 'quickadd', 'weather', 'pomodoro', 'quote', 'shortcuts'];
export const BREAKPOINTS = ['desktop', 'mobile'];

export const LIMITS = { maxWidgets: 40, minW: 120, minH: 80, maxW: 4000, maxH: 4000, maxXY: 20000 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/* The layout a user sees before they have arranged anything: date and time top
   right, a chart in the middle, a task list underneath. */
export const defaultLayout = breakpoint => breakpoint === 'mobile'
  ? [
      { id: 'w-clock',   type: 'clock',   x: 0, y: 0,   w: 340, h: 110, z: 1, config: {} },
      { id: 'w-counter', type: 'counter', x: 0, y: 126, w: 340, h: 130, z: 1, config: { metric: 'overdue' } },
      { id: 'w-list',    type: 'list',    x: 0, y: 272, w: 340, h: 420, z: 1, config: { view: 'open', limit: 8 } }
    ]
  : [
      { id: 'w-clock',   type: 'clock',   x: 700, y: 0,   w: 300, h: 120, z: 1, config: {} },
      { id: 'w-counter', type: 'counter', x: 0,   y: 0,   w: 300, h: 120, z: 1, config: { metric: 'overdue' } },
      { id: 'w-chart',   type: 'chart',   x: 0,   y: 140, w: 460, h: 320, z: 1,
        config: { chart: 'pie', groupBy: 'status', metric: 'count' } },
      { id: 'w-list',    type: 'list',    x: 480, y: 140, w: 520, h: 320, z: 1, config: { view: 'open', limit: 8 } }
    ];

/** Returns { widgets, errors }. Anything unrecognised is dropped rather than
    rejected, so one bad widget cannot lock a user out of their own dashboard. */
export function sanitize(input) {
  const errors = [];
  if (!Array.isArray(input)) return { widgets: [], errors: ['widgets must be an array'] };
  if (input.length > LIMITS.maxWidgets) errors.push(`At most ${LIMITS.maxWidgets} widgets`);

  const seen = new Set();
  const widgets = input.slice(0, LIMITS.maxWidgets).flatMap((w, i) => {
    if (!w || typeof w !== 'object') { errors.push(`widget ${i} is not an object`); return []; }
    if (!TYPES.includes(w.type)) { errors.push(`widget ${i} has unknown type "${w.type}"`); return []; }

    let id = typeof w.id === 'string' && w.id.trim() ? w.id.trim().slice(0, 64) : `w-${i}-${Date.now()}`;
    while (seen.has(id)) id += 'x';           // ids must be unique or React keys collide
    seen.add(id);

    return [{
      id,
      type: w.type,
      x: clamp(num(w.x) ?? 0, 0, LIMITS.maxXY),
      y: clamp(num(w.y) ?? 0, 0, LIMITS.maxXY),
      w: clamp(num(w.w) ?? LIMITS.minW, LIMITS.minW, LIMITS.maxW),
      h: clamp(num(w.h) ?? LIMITS.minH, LIMITS.minH, LIMITS.maxH),
      z: clamp(Math.round(num(w.z) ?? 1), 0, 999),
      config: w.config && typeof w.config === 'object' && !Array.isArray(w.config) ? w.config : {}
    }];
  });
  return { widgets, errors };
}
