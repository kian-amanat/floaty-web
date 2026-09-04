/* Worklet-side maths for the gooey stage. Everything here runs inside the
   frame callback on the UI thread, so each helper carries its own directive. */

import type { RGB } from './constants';

export function clamp(v: number, lo: number, hi: number) {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number) {
  'worklet';
  return a + (b - a) * t;
}

export function window01(v: number, start: number, span: number) {
  'worklet';
  return clamp((v - start) / span, 0, 1);
}

/** exponential approach: framerate independent, no overshoot */
export function approach(dt: number, tau: number) {
  'worklet';
  return 1 - Math.exp(-dt / tau);
}

export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  'worklet';
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)] as const;
}

export function rgbStr(c: RGB) {
  'worklet';
  return `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
}
