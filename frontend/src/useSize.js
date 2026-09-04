import { useLayoutEffect, useRef, useState } from 'react';

/** Measures the element so charts can draw at real pixel size. Widgets are
    resizable, so a fixed viewBox would stretch the marks.

    The first measurement is taken synchronously after layout rather than
    waiting for the ResizeObserver's first callback - that callback is not
    guaranteed to arrive promptly (a hidden or occluded tab can withhold it),
    and a chart that waits for it renders as an empty box until something
    happens to resize it. */
export function useSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (w, h) =>
      setSize(s => (Math.abs(s.w - w) < 1 && Math.abs(s.h - h) < 1 ? s : { w, h }));

    const r = el.getBoundingClientRect();
    measure(r.width, r.height);

    const ro = new ResizeObserver(([e]) => measure(e.contentRect.width, e.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
