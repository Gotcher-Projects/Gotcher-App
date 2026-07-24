import '@testing-library/jest-dom';

// jsdom has no layout engine or ResizeObserver. LayoutRenderer only paints its
// page once a ResizeObserver reports a non-zero width, so stub one that reports a
// fixed canvas width synchronously on observe(). This lets render smoke tests
// exercise the published render path.
class ResizeObserverStub {
  constructor(callback) { this.callback = callback; }
  observe(el) {
    this.callback([{ target: el, contentRect: { width: 600, height: 800 } }]);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;
