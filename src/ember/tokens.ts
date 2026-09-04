/* ---------------------------------------------------------------------------
   Ember — tokens.

   Near-black, one warm accent, and almost nothing else. The accent earns its
   place on exactly three things: the primary action, the focused field's
   hairline, and an inline link. Everywhere else the screen is grey on black —
   spending the colour anywhere else is what made the earlier pass shout.
--------------------------------------------------------------------------- */

import { Platform } from 'react-native';

export const c = {
  bg: '#0B0B0C',
  bgLift: '#111113',

  /* the one accent, warm but restrained */
  hot: '#E8621F',
  hotSoft: '#F0824A',
  hotDeep: '#B8410E',

  text: '#F4F3F1',
  body: '#9B9A97',
  mute: '#6E6D6A',
  ghost: '#484745',

  /* the only other colour on the screen, and only when something is wrong */
  bad: '#E4573D',

  pane: 'rgba(255,255,255,0.028)',
  paneLift: 'rgba(255,255,255,0.05)',
  hair: 'rgba(255,255,255,0.09)',
  hairLift: 'rgba(255,255,255,0.16)',
};

export const hot = (a: number) => `rgba(232,98,31,${a})`;

export const R = {
  field: 12,
  btn: 12,
  chip: 10,
};

export const FIELD_H = 52;
export const BTN_H = 52;
export const GUTTER = 28;

/* One scale, with real steps between them. The display size is the only thing
   allowed to be large; everything else stays quiet so it can be. */
export const t = {
  display: 34,
  displayLine: 38,
  displayTrack: -0.9,

  lede: 15,
  ledeLine: 22,

  label: 13,
  field: 15,
  button: 15,
  micro: 13,
};

/* No webfont is bundled, so this asks for the best face each platform already
   has rather than making the app wait on a download. */
export const sans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", system-ui, sans-serif',
}) as string;

export const sansTight = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", system-ui, sans-serif',
}) as string;
