# surface-scan

A React Native (Expo) build of the field-survey app concept from the reference
capture: a dotted paper home screen with a vertical column of circular records,
the focused one swollen into a squircle, and a tap that opens it full bleed into
a scanning read-out.

```bash
cd surface-scan
npm install
npm run web      # runs in a browser — what this build was verified against
npm run ios      # needs full Xcode installed
npm run android  # needs Android Studio / SDK installed
```

## The two screens

**Home.** Paper (`#FAF9F7`) under an SVG dot lattice. Down the left: the date
block, a pixel emblem, the clock, and the project label. The record column sits
right of centre; whichever card is nearest the focus line grows from a 130pt
circle into a 212 x 196 squircle, interpolated off the scroll offset so it
morphs continuously rather than snapping. Top right is the operator slab — dial,
greeting, capture button. The bottom rail's handle rides the same scroll offset.

**Detail.** The tapped card becomes the backdrop: one shared element animating
position, size and corner radius from the card's rect out to full bleed, with
the chrome fading in behind it. The azimuth line types itself out, the telemetry
block lands late, the read-out is drawn on a dot lattice, and a soft green band
sweeps the frame while it "analyses". Tapping anywhere collapses it back into
the column.

## How things are drawn

Two pieces are built rather than imported:

- **`DotMatrixText`** renders the clock and the read-out from 5x7 glyph
  bitmaps. The capture draws these on a dot lattice rather than setting them in
  a typeface, so a font would have been the wrong tool — and this ships nothing.
- **`PixelMark`** is the emblem, an 11x11 bitmap of a disc quartered by a heavy
  cross.

Everything else is `react-native-svg` (the lattice, the dial, the rail icons) or
plain views.

## Motion

All reveals are driven by shared values and `useAnimatedStyle`, never by
Reanimated's `entering=` layout animations — those do not settle reliably under
`react-native-web`, and left every wrapper stranded at opacity 0 on the first
pass. Driving them by hand also gives the launch its stagger: the left rail
resolves across `intro`, then the five cards deal in 130ms apart.

| | value |
| --- | --- |
| card / focused card | 130 circle, 212 x 196 squircle, radius 44 |
| column pitch | 165 |
| focus line | 28% of screen height |
| open / close | 620ms / 420ms, cubic bezier |
| card deal | 480ms each, 130ms apart |

Layout is authored against the capture's 430 x 932 frame and scaled through
`u()` in `src/theme.ts`, so every number above is in reference units.

## About the imagery

`assets/cards/*.png` are lifted from the reference capture itself. The capture
is a 3D mockup of a phone rotating over a rock surface, so each frame had to be
perspective-corrected back to a flat screen before anything could be read or
cropped — the card thumbnails come out around 130px, which is soft when blown up
full bleed. They are placeholders that make the composition read correctly;
`src/data.ts` is the single place to swap them for real assets.

## Not covered

The reference is a product video, not a screen recording — the phone tumbles
through a lit 3D scene. That staging is video compositing rather than app
behaviour, so this implements what is on the phone's screen, not the scene
around it.

Verified in the browser via `npm run web`. This machine has only the Xcode
Command Line Tools and no Android SDK, so neither simulator could be booted
here; the native targets are unverified.
