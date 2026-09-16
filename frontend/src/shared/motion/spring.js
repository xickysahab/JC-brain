/* The house motion system.

   Every moving thing in this app goes through here, so "how it feels" is one
   decision made once rather than a number guessed per component.

   Two ideas carry the whole file:
     - A spring has no duration. It has a target, and it is always willing to
       take a new one - which is why a spring can be grabbed mid-flight and a
       keyframe cannot.
     - A gesture that ends is not an event, it is a handover. The animation
       picks up at the speed the finger left at, so there is no seam between
       dragging and settling. */

/* Apple describes springs with damping and response rather than mass and
   stiffness; Motion spells the same two as bounce and duration. Overshoot is
   reserved for motion the user's own hand started - a menu that merely
   appeared has no momentum to express. */
export const SPRING = {
  ui:    { type: 'spring', bounce: 0,    duration: 0.35 },  // the default: settles, never bounces
  move:  { type: 'spring', bounce: 0,    duration: 0.4  },  // repositioning something
  sheet: { type: 'spring', bounce: 0.18, duration: 0.3  },  // a surface arriving
  flick: { type: 'spring', bounce: 0.22, duration: 0.4  }   // only after a throw
};

/** Where a flick would come to rest, by the same exponential decay a scroll
    uses. Snap to the target nearest *this*, not nearest the release point -
    that is the difference between throwing something and dropping it. */
export function project(velocity, decelerationRate = 0.998) {
  return (velocity / 1000) * decelerationRate / (1 - decelerationRate);
}

/** Past an edge, follow the finger less and less. A hard stop reads as frozen;
    resistance reads as "still listening, but there is nothing more here". */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Clamp that resists instead of stopping. `dimension` is the span the
    resistance is measured against - usually the element or its container. */
export function resist(value, min, max, dimension) {
  if (value < min) return min - rubberband(min - value, dimension);
  if (value > max) return max + rubberband(value - max, dimension);
  return value;
}

/** The snap point closest to a position. Returns the position itself when
    there is nothing to snap to. */
export function nearest(value, points) {
  if (!points?.length) return value;
  return points.reduce((best, p) => (Math.abs(p - value) < Math.abs(best - value) ? p : best), points[0]);
}

/* Velocity has to be measured over a short window, not between the last two
   events: two moves a millisecond apart give a wild number, and a finger that
   stopped before lifting must hand over zero, not the speed it had a moment
   before. */
export function velocityTracker(windowMs = 100) {
  let samples = [];
  return {
    add(x, y, t = performance.now()) {
      samples.push({ x, y, t });
      const cutoff = t - windowMs;
      // Keep one sample older than the window so a slow drag still has a span.
      while (samples.length > 2 && samples[1].t < cutoff) samples.shift();
    },
    /** @returns {{vx: number, vy: number}} pixels per second */
    read() {
      if (samples.length < 2) return { vx: 0, vy: 0 };
      const a = samples[0], b = samples[samples.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) return { vx: 0, vy: 0 };
      return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
    },
    reset() { samples = []; }
  };
}

/** Whether the viewer asked for less movement. Checked at call time, not at
    import time, so a change of setting is picked up without a reload. */
export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The same intent, expressed gently. Reduced motion is not "no feedback" -
    it is a cross-fade where there would have been a slide. */
export const spring = preset => (reducedMotion() ? { duration: 0.16, ease: 'easeOut' } : preset);
