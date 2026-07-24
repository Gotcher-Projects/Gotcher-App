import { useLayoutEffect, useState } from "react";

// Fit-to-box font sizing for layout text blocks.
// Measures the ref element's content against its fixed-height box and returns a
// font size (px) that fills it: long text shrinks (never below `minSize`) so it
// never clips, and short text grows up to `maxSize` so it doesn't leave the box
// mostly empty. Used by both the layout editor and the published renderer so the
// two always agree. With the default `maxSize === baseSize` it is shrink-only
// (unchanged behavior for existing callers).
//
// Measurement is done in unscaled layout pixels (scrollHeight/clientHeight are
// unaffected by the canvas CSS transform), so the result is identical in the
// editor and the published view regardless of display size.
export function useFittedFontSize(ref, baseSize, minSize = 8, deps = [], maxSize = baseSize) {
  const [size, setSize] = useState(baseSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevInline = el.style.fontSize;
    const fits = (px) => {
      el.style.fontSize = px + "px";
      return el.scrollHeight <= el.clientHeight + 0.5;
    };
    let best;
    if (!fits(baseSize)) {
      // Too big at base size → shrink-search [minSize, baseSize].
      best = minSize;
      let lo = minSize, hi = baseSize;
      for (let i = 0; i < 9 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }
    } else if (maxSize > baseSize && fits(maxSize)) {
      // Fits even at the ceiling → use the ceiling.
      best = maxSize;
    } else if (maxSize > baseSize) {
      // Short text → grow-search [baseSize, maxSize] to fill the box.
      best = baseSize;
      let lo = baseSize, hi = maxSize;
      for (let i = 0; i < 9 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }
    } else {
      best = baseSize;
    }
    el.style.fontSize = prevInline;
    setSize(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return size;
}
