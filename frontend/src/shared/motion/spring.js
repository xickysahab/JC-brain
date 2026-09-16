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

/* ---------------------------------------------------------------------------
   The integrator.

   Motion drives the component-level work - presence, layout, transforms on a
   DOM node - and does it well. Handing it a bare number is a different path,
   and on this build that path resolves in two frames instead of springing, so
   the gesture layer runs on its own integrator. It is twenty lines, it is
   pure, and the settle after a drag is the one motion in the app that has to
   be exactly right.

   Apple's two parameters rather than the physics triplet:
     damping   1 settles without overshoot, below 1 bounces
     response  seconds to reach the target - not a duration, a stiffness
   --------------------------------------------------------------------------- */

/** One step of a damped harmonic oscillator. Pure, so the physics can be
    tested without a browser. @returns {{value:number, velocity:number}} */
export function springStep({ value, velocity }, target, dt, { damping = 1, response = 0.4 } = {}) {
  const w = (2 * Math.PI) / response;          // natural frequency
  const a = -(w * w) * (value - target) - 2 * damping * w * velocity;
  const v = velocity + a * dt;
  return { value: value + v * dt, velocity: v };
}

/** True once the spring is close enough and slow enough that another frame
    would not change a pixel. */
export const springAtRest = ({ value, velocity }, target) =>
  Math.abs(value - target) < 0.08 && Math.abs(velocity) < 0.08;

/**
 * Run a spring to a target, starting at whatever speed the gesture ended on.
 * @returns {{stop: Function}} stopping is how an interruption takes over.
 */
export function springTo({ from, to, velocity = 0, damping, response, onUpdate, onRest }) {
  /* Nothing to travel through: a hidden tab's frame clock all but stops, so a
     spring started there would hang half way and stay there. Arriving at once
     is the honest answer - nobody is watching the journey. */
  const jump = () => { onUpdate?.(to); onRest?.(); return { stop() {} }; };
  if (reducedMotion() || document.visibilityState === 'hidden') return jump();

  let state = { value: from, velocity };
  let last = performance.now();
  let frame = 0;
  let live = true;

  const finish = () => {
    if (!live) return;
    live = false;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onHide);
    onUpdate?.(to);
    onRest?.();
  };
  const onHide = () => { if (document.visibilityState === 'hidden') finish(); };
  document.addEventListener('visibilitychange', onHide);

  const tick = now => {
    // A long frame - a background tab, a slow paint - must not be integrated
    // as one huge step, or the spring explodes instead of settling.
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    state = springStep(state, to, dt, { damping, response });

    if (springAtRest(state, to)) { finish(); return; }
    onUpdate?.(state.value);
    frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);
  return {
    /* Stopping leaves the value wherever it is - that is what an interruption
       wants, because the new gesture is about to take it from there. */
    stop() {
      if (!live) return;
      live = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onHide);
    }
  };
}
