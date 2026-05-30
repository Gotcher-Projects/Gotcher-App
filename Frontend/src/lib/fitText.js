import { useLayoutEffect, useState } from "react";

// Shrink-to-fit safety net for layout text blocks.
// Measures the ref element's content against its fixed-height box and returns a
// font size (px) that fits — falling back no lower than `minSize`. Used by both
// the layout editor and the published renderer so long entries never clip.
//
// Measurement is done in unscaled layout pixels (scrollHeight/clientHeight are
// unaffected by the canvas CSS transform), so the result is identical in the
// editor and the published view regardless of display size.
export function useFittedFontSize(ref, baseSize, minSize = 8, deps = []) {
  const [size, setSize] = useState(baseSize);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prevInline = el.style.fontSize;
    const fits = (px) => {
      el.style.fontSize = px + "px";
      return el.scrollHeight <= el.clientHeight + 0.5;
    };
    let best = minSize;
    if (fits(baseSize)) {
      best = baseSize;
    } else {
      let lo = minSize, hi = baseSize;
      for (let i = 0; i < 9 && hi - lo > 0.5; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) { best = mid; lo = mid; } else { hi = mid; }
      }
    }
    el.style.fontSize = prevInline;
    setSize(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return size;
}
