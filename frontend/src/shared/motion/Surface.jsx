import { useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SPRING, spring, reducedMotion } from './spring.js';

/* Every floating surface in the app - modal, palette, toast - arrives and
   leaves through here, so they cannot drift apart.

   Three rules from the motion system are baked in rather than repeated:
     - it leaves along the path it arrived on, so the way back is the way in;
     - it grows from whatever opened it, not from the middle of the screen,
       so the link between the control and the content is visible;
     - it materialises - blur and scale move together - so glass reads as a
       real surface arriving rather than an image being faded up. */

const from = () => (reducedMotion()
  ? { opacity: 0 }
  : { opacity: 0, scale: 0.94, filter: 'blur(10px)' });

const to = () => (reducedMotion()
  ? { opacity: 1 }
  : { opacity: 1, scale: 1, filter: 'blur(0px)' });

/** The dimming layer behind a modal task. A parallel, non-blocking panel
    should not use one: a scrim says "finish this first". */
export function Scrim({ show, onClick, z = 19 }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="scrim" style={{ zIndex: z }} onClick={onClick}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        />
      )}
    </AnimatePresence>
  );
}

/**
 * @param {object} p
 * @param {boolean} p.show
 * @param {{x:number,y:number}=} p.anchor  viewport point this grew from
 */
export function Surface({ show, anchor, className, style, children, ...rest }) {
  return (
    <AnimatePresence>
      {show && <Anchored anchor={anchor} className={className} style={style} {...rest}>{children}</Anchored>}
    </AnimatePresence>
  );
}

function Anchored({ anchor, className, style, children, ...rest }) {
  const ref = useRef(null);
  const [origin, setOrigin] = useState('center');

  /* Measured before the first paint: the surface has to already be growing
     from the right corner on frame one, not correct itself on frame two. */
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const clamp = (v, max) => Math.max(0, Math.min(max, v));
    setOrigin(`${clamp(anchor.x - r.left, r.width)}px ${clamp(anchor.y - r.top, r.height)}px`);
  }, [anchor]);

  return (
    <motion.div
      ref={ref} className={className} style={{ ...style, transformOrigin: origin }}
      initial={from()} animate={to()} exit={from()}
      transition={spring(SPRING.sheet)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
