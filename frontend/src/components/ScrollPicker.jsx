import { useRef, useEffect, useCallback } from 'react';

const ITEM_H = 40;        // height of each item in the drum
const VISIBLE = 5;         // how many items visible at once
const CONTAINER_H = ITEM_H * VISIBLE;

/**
 * iOS-style scroll drum picker.
 * Props:
 *   items     – array of { value, label }
 *   value     – currently selected value
 *   onChange  – called with new value on pick
 */
export default function ScrollPicker({ items, value, onChange }) {
  const listRef = useRef(null);
  const isScrolling = useRef(false);
  const rafId = useRef(null);

  const selectedIdx = items.findIndex(i => i.value === value);
  const idx = selectedIdx === -1 ? 0 : selectedIdx;

  // Scroll to the selected item on mount and when value changes externally
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const target = idx * ITEM_H;
    el.scrollTop = target;
  }, [idx]);

  const snapToNearest = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const raw = el.scrollTop;
    const nearest = Math.round(raw / ITEM_H);
    const clamped = Math.max(0, Math.min(nearest, items.length - 1));
    el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
    if (items[clamped] && items[clamped].value !== value) {
      onChange(items[clamped].value);
    }
  }, [items, value, onChange]);

  const handleScroll = () => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    isScrolling.current = true;
    rafId.current = requestAnimationFrame(() => {
      // Debounce: wait for scroll to settle
      clearTimeout(listRef.current?._snapTimer);
      if (listRef.current) {
        listRef.current._snapTimer = setTimeout(() => {
          isScrolling.current = false;
          snapToNearest();
        }, 80);
      }
    });
  };

  // Padding items so the first/last can be centered
  const padCount = Math.floor(VISIBLE / 2);

  return (
    <div className="drum-picker" style={{ height: CONTAINER_H }}>
      {/* Highlight band in the center */}
      <div className="drum-highlight" style={{ top: padCount * ITEM_H, height: ITEM_H }} />
      {/* Fade overlays */}
      <div className="drum-fade drum-fade-top" style={{ height: padCount * ITEM_H }} />
      <div className="drum-fade drum-fade-bottom" style={{ height: padCount * ITEM_H }} />

      <div
        ref={listRef}
        className="drum-scroll"
        onScroll={handleScroll}
        style={{ height: CONTAINER_H }}
      >
        {/* Top padding */}
        {Array.from({ length: padCount }).map((_, i) => (
          <div key={`pt-${i}`} className="drum-item drum-pad" style={{ height: ITEM_H }} />
        ))}

        {items.map((item, i) => {
          const isSel = i === idx;
          return (
            <div
              key={item.value}
              className={'drum-item' + (isSel ? ' selected' : '')}
              style={{ height: ITEM_H, lineHeight: `${ITEM_H}px` }}
              onClick={() => {
                const el = listRef.current;
                if (el) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                onChange(item.value);
              }}
            >
              {item.label}
            </div>
          );
        })}

        {/* Bottom padding */}
        {Array.from({ length: padCount }).map((_, i) => (
          <div key={`pb-${i}`} className="drum-item drum-pad" style={{ height: ITEM_H }} />
        ))}
      </div>
    </div>
  );
}
