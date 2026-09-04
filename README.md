# surface-scan

Five screens in one Expo app, each rebuilt from a reference capture: a
field-survey browser, a weight dial, a gooey card interaction, and a sign-in /
create-account pair. They share nothing but the runtime — each is its own
design, on its own URL.

```bash
cd surface-scan
npm install
npm run web      # runs in a browser — what this build was verified against
npm run ios      # needs full Xcode installed
npm run android  # needs Android Studio / SDK installed
```

## Reviewing

**Read [REVIEW.md](REVIEW.md) first.** It covers which route is which, what
viewport to use (430 x 932), and what to do on each screen to see it move.

One thing worth repeating here, because it wastes the most time: every screen
animates through `requestAnimationFrame`, which browsers pause for a hidden
tab. A backgrounded window or a collapsed preview pane renders the first frame
and then freezes, which reads as a bug rather than a paused clock. Keep the tab
focused.

## The screens

| screen | route | source |
| --- | --- | --- |
| Scan — survey browser | `/` | `src/screens/HomeScreen.tsx`, `DetailScreen.tsx` |
| Weight dial | `/weight` | `src/components/WeightSlider.tsx` |
| Gooey cards | `/#gooey` | `src/screens/GooeyScreen.tsx`, `src/gooey/` |
| Sign in / Create account | `/login`, `/login#signup` | `src/ember/` |

Routing is `src/route.ts` — a hand-rolled reader over the path and hash, since
three of the four designs have no room for an in-app switcher. Anything
unrecognised falls through to the scan screen.

---

# Scan — the survey browser

**Home.** Paper (`#FAF9F7`) under an SVG dot lattice. Down the left: the date
block, a pixel emblem, the clock, and the project label. The record column sits
right of centre; whichever card is nearest the focus line grows from a 121pt
circle into a 182 x 179 squircle, interpolated off the scroll offset so it
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
pass. Driving them by hand also gives the launch its stagger.

| | value | where |
| --- | --- | --- |
| card / focused card | 121 circle, 182 x 179 squircle, radius 38 | `theme.ts` |
| column pitch | 157 | `theme.ts` |
| focus line | 12.5% of screen height | `theme.ts` |
| open / close | 950ms / 420ms, cubic bezier | `App.tsx` |
| card deal | 1300ms each, 390ms apart | `App.tsx` |
| left rail + badge | 1500ms | `App.tsx` |
| scan sweep | starts at 2000ms, settles ~5.9s | `App.tsx` |

Layout is authored against the capture's 430 x 932 frame and scaled through
`u()` in `src/theme.ts`, so every number above is in reference units.

The sweep is a scripted sequence rather than a reaction to scroll: the capture
walks the focus 3 → 1 → 5 → 4 and settles on 3, and `sweep()` in `App.tsx`
reproduces it step by step off the measured peaks.

## About the imagery

`assets/cards/*.png` are lifted from the reference capture itself. The capture
is a 3D mockup of a phone rotating over a rock surface, so each frame had to be
perspective-corrected back to a flat screen before anything could be read or
cropped — the card thumbnails come out around 130px, which is soft when blown up
full bleed. They are placeholders that make the composition read correctly;
`src/data.ts` is the single place to swap them for real assets.

---

# The other screens

Each is documented where it lives; this is only the map.

**Weight dial** (`/weight`) — a bending ruler, a glowing accent line, and a
large readout, drag-driven over 0–36 lbs. The glow is three blurred passes
rather than stacked strokes: stacking leaves contour bands, one blur does not.
Constants and their derivations are commented in `WeightSlider.tsx`.

**Gooey cards** (`/#gooey`) — one black metaball thrown between two circular
photographs, melted into them by an SVG blur-plus-threshold filter. The physics
is in `src/gooey/step.ts`, deliberately free of anything Reanimated so it can be
stepped in plain Node and checked against the original. `reference/pxdx-gooey-cards/`
is that original — **not dead code**, the parity harness executes it.

**Auth pair** (`/login`) — one surface for both modes, morphing in place rather
than swapping screens, under a warm aurora wash. `prefers-reduced-motion` is
honoured. Source in `src/ember/`.

## Checks

```bash
node scripts/gooey-parity.mjs     # holds the gooey physics to the original, frame by frame
node scripts/gooey-gesture.mjs    # the gesture properties parity cannot see
npx tsc --noEmit
```

`gooey-parity` runs the original web implementation inside a VM alongside the
port, steps both for the full 11.3s at 1/60, and fails on drift — currently
0.15px worst case on a 672px stage. Run both after touching `src/gooey/`.

## Not covered

The scan reference is a product video, not a screen recording — the phone
tumbles through a lit 3D scene. That staging is video compositing rather than
app behaviour, so this implements what is on the phone's screen, not the scene
around it.

Verified in the browser via `npm run web`. This machine has only the Xcode
Command Line Tools and no Android SDK, so neither simulator could be booted
here; the native targets are unverified. [REVIEW.md](REVIEW.md) lists the
per-screen limits — which behaviour was measured and which was only read.
