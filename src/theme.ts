import { Dimensions, Platform } from 'react-native';

/* The screen was authored against the 430 x 932 reference capture; everything
   below is expressed in those units and scaled to the running device. */
export const REF_W = 430;
export const REF_H = 932;

const win = Dimensions.get('window');
/* Sampled once, so a zero here is permanent: if this module is evaluated
   before the window has a size, u() returns 0 for the rest of the session and
   every screen collapses silently, with no error to point at it. Falling back
   to the reference frame keeps the layout usable instead. */
export const SCREEN = { w: win.width || REF_W, h: win.height || REF_H };

/** reference units -> device points */
export const u = (n: number) => (n * SCREEN.w) / REF_W;

export const colors = {
  paper: '#FAF9F7',
  ink: '#12110F',
  muted: '#8A8781',
  faint: 'rgba(18,17,15,0.13)',
  panel: '#0B0B0C',
  panelEdge: '#242427',
  white: '#FFFFFF',
  sky: '#C5BCB6',
  scan: '#5BE08A',
};

export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}) as string;

/* carousel geometry, in reference units */
export const CARD = 121;      // resting circle
export const FOCUS_W = 182;   // focused squircle
export const FOCUS_H = 179;
export const FOCUS_R = 38;
export const SLOT = 157;      // vertical pitch between cards
export const COLUMN_X = 211;  // centre of the card column
export const CARD_ENTRY_Y = 855;  // cards deal in from here, just off the bottom
export const FOCUS_Y = 0.125;  // focus line, as a fraction of screen height

/* The scan settles on index 2, so the column has to be scrollable two slots
   back from its resting position for the first two cards to be able to reach
   the square. LEAD is that room, and the list is parked at it on mount. */
export const REST_INDEX = 2;
export const LEAD = REST_INDEX * SLOT;
