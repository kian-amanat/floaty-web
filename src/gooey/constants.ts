/* ---------------------------------------------------------------------------
   PXDX Sketch Book — gooey cards, constants.

   Every number here was fitted against the 672 x 848 / 30fps reference capture
   (see ../../reference/pxdx-gooey-cards/README.md for how each was solved).
   They are stage units; the screen scales the whole stage to the device.
--------------------------------------------------------------------------- */

export const DESIGN = { w: 672, h: 848 };

export const PAPER = '#dddddd';
export const INK = '#000000';
export const DOT = 'rgba(0,0,0,0.085)';
export const DOT_PITCH = 8.15;
export const DOT_R = 0.65;
/* radial-gradient(circle at 1px 1px) offset by background-position: 0.5px */
export const DOT_AT = 1.5;

export const DISC_R = 67;      // black disc behind each photo
export const BALL_R = 48;      // the travelling metaball
export const RING = 0.881;     // photo scale when awake -> 8px black ring

export const PILL_H = 29;
export const PILL_Y = 90.5;    // pill centre, below the card centre
export const CHIP_H = 19;
export const CHIP_MIN_W = 19;

export const R_HIT = 130;        // pointer radius that engages a card
export const SHOW_ARROW: [number, number] = [45, 26]; // dot + arrow fade window
export const SETTLE_REF = 110;   // ball lag beyond which dot + arrow blur away

/* the ball shoves a disc off its mark as it plows into it, and the disc springs
   back. Only a *closing* ball pushes, which is why card 1 never budges (its
   ball is always leaving) while card 2 takes the throw square on. */
export const PUSH_GAIN = 2.6;
export const PUSH_STIFF = 5.0;
export const PUSH_DAMP = 4.5;
export const PUSH_MAX = 34;      // a fast flick must not launch a disc off its mark

export const TAU_BALL = 0.5;
export const TAU_ACT = 0.16;
export const TAU_WAKE_IN = 0.3;
export const TAU_WAKE_OUT = 0.45;
export const TAU_SCALE = 0.18;
export const TAU_REVEAL = 0.1;
export const TAU_PILL_IN = 0.2;
export const TAU_PILL_OUT = 0.07;

export const CHIP_IDLE_BG: RGB = [0x55, 0x55, 0x55];
export const CHIP_IDLE_FG: RGB = [0xff, 0xff, 0xff];

export type RGB = readonly [number, number, number];

export type CardSpec = {
  cx: number;
  cy: number;
  /** what the card is holding when the piece is first opened */
  value: number;
  chipBg: RGB;
  chipFg: RGB;
};

/** Moved from the throwing card to the receiving one, per throw. */
export const TRANSFER = 56;

/** How close the bubble itself has to get before it counts as arrived. The
 *  finger reaching the far card is only the aim — the reaches meet at the
 *  midpoint, so committing there would land the throw halfway across, with the
 *  bubble still in the air. This is the distance at which it is under the
 *  disc and read as absorbed. */
export const ABSORB = 45;

export const CARDS: CardSpec[] = [
  {
    cx: 208, cy: 407, value: 189,
    chipBg: [0x55, 0x55, 0x55], chipFg: [0xff, 0xff, 0xff],
  },
  {
    cx: 465, cy: 407, value: 89,
    chipBg: [0xff, 0xff, 0xff], chipFg: [0x00, 0x00, 0x00],
  },
];

/** '$189', from whatever the card is holding now. */
export function priceLabel(v: number): string {
  'worklet';
  return `$${Math.round(v)}`;
}

/** The card holding the bubble is the one about to give it away, so it reads
 *  negative and the card across from it reads positive. Neither side owns a
 *  sign: throw it back and the two swap over. */
export function deltaLabel(i: number, active: number, n: number): string {
  'worklet';
  return `${i === active ? '-' : '+'}${n}`;
}

export const META_ID = 'TEST0326-03';
export const META_LINES = [
  'PXDX SKETCH BOOK',
  'EXPLORING DETAILS',
  'UI TRENDS',
  'IB0326007',
];
