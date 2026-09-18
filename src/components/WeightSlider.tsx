import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, useAnimatedReaction,
  useDerivedValue, withTiming, runOnJS, interpolate, interpolateColor,
  Extrapolation, Easing, SharedValue,
} from 'react-native-reanimated';
import Svg, {
  Path, Circle, Rect, Defs, Mask, Stop, G, ClipPath,
  LinearGradient, RadialGradient, Polygon,
} from 'react-native-svg';

/* Vertical weight dial, measured off the reference capture (640x480 @30fps)
   frame by frame. Every constant below is in capture pixels, which are used
   directly as 430-wide reference units — the component was authored at 1:1
   with the capture so nothing had to be re-proportioned.

   SCALE      ticks every 11.083px = 1 lb, majors (brighter, not longer) every
              6; the track runs y 42..444 in the capture = 36..0 lbs.
   TRACK      x 296, grey #767676 above the thumb, accent below.
   BEND       the line is pushed LEFT around the thumb: peak 23px, reaching
              zero by 52px either side, symmetric about the thumb centre and
              best fit by a raised cosine (sse 841 vs 856 for a gaussian).
   KNOB       centre 31px right of the line, r=36, interior the same colour as
              the page with a light top rim and a dark bottom shadow.
   COLOUR     hue falls linearly with value: 94.7 - 2.256*v degrees at S .74
              V .99. Predicted #FCEA42 at v=18 against #FDE741 sampled. */

const MIN = 0;
const MAX = 36;
const PX_PER_LB = 11.083;

/* The whole composition is the capture's own frame, used 1:1 — 640x480 with
   the scale running y 43..442. Cropping it into a tall portrait canvas is what
   threw the negative space and the relationship between the parts out; every
   coordinate below is now the pixel it sits on in the capture. */
/* The capture's frame is 640x480 but the dial only occupies x 204..462,
   y 42..448 of it — 40% of the width, so 60% is empty background. Fitting that
   whole frame to a phone left every part of the control looking small at once,
   which is the giveaway that it was framing and not the parts. The viewBox is
   cropped to the content instead, so the geometry below is untouched and the
   whole system simply renders larger. Padding: the readout is centred on the
   thumb and reaches y 3 at 36 lbs and y 482 at 0, and the label under the thumb
   grows leftward to about x 205. */
/* Left padding is set so the composition sits centred: content runs 204..478
   at a two-digit readout, so 32 either side balances it. It was 20 on the left
   against 36 on the right, which pulled everything visibly off-centre. */
const VIEW_X = 172;
const VIEW_Y = 0;
/* Right edge has to clear the WIDEST readout, not the current one, or the
   number reflows as you drag: "36" measures 128 against 104 for "17", so the
   box runs to 378 + 128 + pad. */
const CANVAS_W = 342;                             // 172..514
const CANVAS_H = 486;                             // readout reaches y 482 at 0 lbs

const TRACK_X = 296;
const TRACK_BOT = 442;                            // value 0
const TRACK_H = (MAX - MIN) * PX_PER_LB;          // 399
const TRACK_TOP = TRACK_BOT - TRACK_H;            // 43, value 36

const TICK_X0 = 268;                              // majors, 16 long
const TICK_X1 = 284;
const TICK_MINOR_INSET = 1;                       // minors measure 14
const LABEL_RIGHT = 249;
const KNOB_CX = 327;
const KNOB_R = 33;
const KNOB_PAD = 8;
const KNOB_BOX = (KNOB_R + KNOB_PAD) * 2;
const NUMBER_LEFT = 378;

const BEND_A = 23;
const BEND_W = 52;
/* The ruler bends with the line, not just the line: the tick that sits under
   the thumb measures x 251..264 against 269..283 everywhere else, and the
   label beside it lands with its right edge on 231 = 249 - 18. So ticks and
   labels are displaced by the same curve at a shallower amplitude. */
const RULER_A = 18;
/* and the label the thumb is on grows: its glyph is 27 rows against 18 for the
   rest, right-aligned first and scaled about that right edge */
const LABEL_GROW = 0.5;
const LABEL_W = 56;
/* Only the single farthest label drops out. At the top of the ruler that is
   6 (333 away) while 12 (266) stays; at the bottom it is 30 (332) while 24
   (266) stays — so the cutoff sits between those two distances. The capture's
   own cliff reads nearer 190, but its thumb only ever travels 11..26 so it
   never puts a numeric label much beyond 220; this is the asked-for behaviour
   across the full 0..36 range. */
/* Measured off the capture: at 21 the '6' is 166px from the thumb and still
   reading, at 25 it is 211px away and gone. So the cliff sits just under 211
   and the fade runs the ~45px before it. The old 315 was further than the
   ruler is long (36 lb = 399px), so in practice nothing was ever culled —
   which is why every label stayed lit at the top of the range. */
const LABEL_OUT = 205;                            // gone by here
const LABEL_OUT_FADE = 45;                        // over this much
/* accent holds .98 at 85px above the thumb, .87 at 100, .59 at 130, gone by 170 */
const TAIL = 180;

/* The halo is light bleeding off the lit line, not a lamp at the thumb. Read
   10px from the line along its whole length it runs 5/22/62/107/111/103/90/87/
   71/36/9/0 from dy -93 up to +87 — reaching ~95 above and ~85 below while
   going only ~48 sideways, and peaking about 23 ABOVE the thumb.

   It is a genuine gaussian blur of the line. Stacking widening strokes was the
   obvious approximation and it is the wrong one: even thirteen layers leave
   visible contour bands in the haze, because each layer has a hard edge. One
   blurred stroke has none. Width and sigma are fitted to the sideways falloff
   (.66/.475/.317/.205/.106/0 at 0/10/20/30/40/48px), then opened up a little
   from there: against the reference the fitted pair reads as a haze on the
   line rather than something lighting the ruler. */
/* All three glow passes share one filter region, and it is the smallest one
   that can hold the result rather than the whole canvas.

   Two things bound it. The glow is clipped to the left of the line, and the
   line never gets past TRACK_X, so nothing survives to the right of that.
   And output beyond the canvas is never drawn, so margin outside it — which
   is what sizing a region at n sigma buys — is blurred and then thrown away.

   That takes the three passes from ~2.8 Mpx a frame to ~0.75 at dpr 2, on a
   filter that reruns on every frame of a drag. Nothing about the result
   changes; the pixels that went away were never on screen. */
/* the line's x at the thumb — the bend always peaks there, so the horizontal
   falloff is anchored to where the glow is actually brightest */
const GLOW_EDGE = TRACK_X - BEND_A;
/* how far the haze carries from the thumb, and how hard it is at the centre */
const GLOW_R = 70;
/* How far past the end marks the haze is allowed to reach. Short, so at 0 or
   36 the light is visibly stopped by the end of the ruler rather than floating
   in the margin — but not zero, or the boundary is a cut. */
const GLOW_EDGE_FEATHER = 10;
const GLOW_PEAK = 0.80;
const GLOW_X = VIEW_X;

/* The three passes were strokes of width 46 / 30 / 19 blurred at sigma
   33 / 19.5 / 11, at opacity .72 / 1 / .82. Those pairs are gone but they are
   what the gradient stops below were computed from — the profile of a stroke
   of width W under sigma s at distance d is
       .5 * (erf((d + W/2) / (s*sqrt2)) - erf((d - W/2) / (s*sqrt2)))
   normalised to its value on the line. Re-derive from there if a pass wants
   reshaping; do not hand-edit the stops. */
/* A second, softer pass sits inside the halo so the peak reads as a
   concentrated source rather than an evenly-lit patch. */

/* Outside the halo sits a much wider, dimmer spill. The halo alone reads as a
   haze clinging to the line; what the reference has is a lamp behind it, with
   light landing well out across the ticks and up onto the numbers. That is a
   third blurred pass rather than a stronger halo — pushing the halo itself
   this wide either blows out the line's own edge or, at a lower opacity,
   flattens the whole thing into an even wash with no source in it.
   Taller as well as wider: a lamp spills further along the line than across
   it, so this reaches past the labels either side of the thumb. */

const PAGE = '#222322';
const TRACK = '#767676';
const TICK_MINOR = '#333433';
const TICK_MAJOR = '#868686';
/* The thumb has two states in the capture. Pressed, it carries a lit bezel
   ring at r 22..30 peaking +20 lum at r=26 and its chevrons read 170; at rest
   there is no ring at all and the chevrons read 72, with a deeper, wider
   shadow instead. The trigger is the PRESS, not movement: at t 3.6-4.4 the
   value is parked on 26 and the ring is at its strongest, while at t 1.6-2.2
   it is parked on 12 and idle. It crossfades over roughly 0.4s either way. */
const CHEVRON_IDLE = '#484848';
const CHEVRON_ACTIVE = '#AAAAAA';
const PRESS_IN = 320;
const PRESS_OUT = 380;

/* hue = 94.7 - 2.256*value, S .74, V .99, sampled every 6 lbs */
const RAMP_V = [0, 6, 12, 18, 24, 30, 36];
const RAMP_C = ['#90FC42', '#BBFC42', '#E5FC42', '#FCEA42', '#FCC042', '#FC9642', '#FC6C42'];

const LABELS = [6, 12, 18, 24, 30];

/* The accent has to be a plain string, not an animated prop: react-native-svg
   applies an animated `d` happily but leaves `stroke` and `fill` on their
   first value, which left the line and the halo stuck on the value-18 yellow
   while the readout had already gone lime. Driving it from the rounded value
   costs one render per pound — 2.25 degrees of hue, invisible as a step. */
/* The readout is the same light source as the line but must not compete with
   it, so it sits a little below the accent: pulled slightly toward neutral to
   drop saturation and a little off full value. Kept as one adjustment on the
   accent rather than a second colour, so it tracks the ramp across the range.
   For the record the capture measures the number at #FFE742, sat .74, and a
   stroke/height ratio of .089 — so this is a deliberate step softer than the
   source, not a correction toward it. */
function readoutTint(rgb: string) {
  const m = (rgb.match(/\d+/g) ?? ['255', '255', '255']).map(Number);
  const grey = (m[0] + m[1] + m[2]) / 3;
  const t = m.map((c) => Math.round((c * 0.86 + grey * 0.14) * 0.93));
  return `rgb(${t[0]}, ${t[1]}, ${t[2]})`;
}

function accentFor(v: number) {
  const t = Math.min(1, Math.max(0, (v - MIN) / (MAX - MIN))) * (RAMP_C.length - 1);
  const i = Math.min(RAMP_C.length - 2, Math.floor(t));
  const f = t - i;
  const rgb = (h: string) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const a = rgb(RAMP_C[i]);
  const b = rgb(RAMP_C[i + 1]);
  const m = a.map((c, k) => Math.round(c + (b[k] - c) * f));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}

const APath = Animated.createAnimatedComponent(Path);
const AGradient = Animated.createAnimatedComponent(LinearGradient);
const ARadial = Animated.createAnimatedComponent(RadialGradient);
const AText = Animated.createAnimatedComponent(Text);

const yFor = (v: number) => {
  'worklet';
  return TRACK_BOT - v * PX_PER_LB;
};

/** the deflection either side of the thumb, a raised cosine */
function bendAt(y: number, knobY: number, amp: number) {
  'worklet';
  const t = Math.abs(y - knobY) / BEND_W;
  return t >= 1 ? 0 : amp * 0.5 * (1 + Math.cos(Math.PI * t));
}

/* Everything left of the line, bounded on the right BY the line. Sampling
   across the capture, the halo is worth +41..+117 lum just left of the line and
   flat background on the other side of it — the glow never crosses onto the
   knob side, so it is clipped rather than merely faded. */
function leftOfLinePath(knobY: number) {
  'worklet';
  const top = VIEW_Y;
  const bot = VIEW_Y + CANVAS_H;
  const y0 = Math.max(top, knobY - BEND_W);
  const y1 = Math.min(bot, knobY + BEND_W);
  let d = `M${VIEW_X} ${top} L${(TRACK_X - bendAt(top, knobY, BEND_A)).toFixed(2)} ${top}`;
  if (y0 > top) d += ` L${TRACK_X} ${y0.toFixed(2)}`;
  const N = 30;
  for (let i = 1; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    d += ` L${(TRACK_X - bendAt(y, knobY, BEND_A)).toFixed(2)} ${y.toFixed(2)}`;
  }
  if (y1 < bot) d += ` L${TRACK_X} ${bot}`;
  return `${d} L${VIEW_X} ${bot} Z`;
}

/** every tick of one weight, as a single path so the bend can animate */
function ticksPath(knobY: number, major: boolean) {
  'worklet';
  let d = '';
  for (let i = 0; i <= MAX - MIN; i++) {
    if ((i % 6 === 0) !== major) continue;
    const y = TRACK_BOT - i * PX_PER_LB;
    const dx = bendAt(y, knobY, RULER_A);
    const a = (major ? TICK_X0 : TICK_X0 + TICK_MINOR_INSET) - dx;
    const b = (major ? TICK_X1 : TICK_X1 - TICK_MINOR_INSET) - dx;
    d += `M${a.toFixed(2)} ${y.toFixed(2)} L${b.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d;
}

/** the track as a polyline, straight except for the bump around the thumb.
    The bend is sampled from the line's real deflection at every endpoint, so
    when the thumb reaches a limit the line emerges already displaced instead
    of jumping sideways. Previously the path opened at TRACK_X while the bend
    at that same y was already 23 out, which put a hard horizontal step at the
    top of the ruler at 36 lbs and at the bottom at 0. */
function trackPath(knobY: number) {
  'worklet';
  const y0 = Math.max(TRACK_TOP, knobY - BEND_W);
  const y1 = Math.min(TRACK_BOT, knobY + BEND_W);
  let d = `M${(TRACK_X - bendAt(TRACK_TOP, knobY, BEND_A)).toFixed(2)} ${TRACK_TOP}`;
  if (y0 > TRACK_TOP) d += ` L${TRACK_X} ${y0.toFixed(2)}`;
  const N = 34;
  for (let i = 1; i <= N; i++) {
    const y = y0 + ((y1 - y0) * i) / N;
    d += ` L${(TRACK_X - bendAt(y, knobY, BEND_A)).toFixed(2)} ${y.toFixed(2)}`;
  }
  if (y1 < TRACK_BOT) d += ` L${TRACK_X} ${TRACK_BOT}`;
  return d;
}

export default function WeightSlider({
  initial = 17,
  onChange,
  box,
}: {
  initial?: number;
  onChange?: (v: number) => void;
  /* the space the frame has to fit into; it keeps 4:3 and centres inside it */
  box?: { w: number; h: number };
}) {
  /* Reference units -> device px. Deliberately NOT theme's u(): that samples
     Dimensions once at module load, so anything imported before the window has
     a size is stuck with a scale of zero for the life of the session. */
  const [frameW, setFrameW] = useState(0);
  const onFrameLayout = (e: LayoutChangeEvent) => setFrameW(e.nativeEvent.layout.width);
  /* Sizing is left entirely to layout — the frame carries aspectRatio and
     maxHeight, so yoga fits it and the Svg follows through its viewBox. Doing
     the arithmetic in JS was fragile: useWindowDimensions went stale across a
     resize and the frame rendered 700 wide inside a 571 viewport, hanging off
     the edge. S is only needed to size the RN text, and is measured back off
     the frame itself, so at worst the labels trail the box by one frame. */
  const win = useWindowDimensions();
  /* onLayout is not dependable everywhere — in some hosts the screen's own
     layout callback never fires — so the height that caps the width falls back
     to the window. Without the cap yoga clamps only the HEIGHT and the frame
     stretched to 1000x700 on a short wide viewport. */
  const availH = box && box.h > 0 ? box.h : win.height;
  const measured = frameW > 0 ? frameW : box && box.w > 0 ? box.w : Math.min(win.width, (availH * CANVAS_W) / CANVAS_H);
  const S = measured / CANVAS_W || 1;
  const px = (n: number) => n * S;
  const styles = React.useMemo(() => sheet(S), [S]);

  const v = useSharedValue(initial);
  const start = useSharedValue(initial);
  const [shown, setShown] = useState(Math.round(initial));

  /* the capture never snaps — the thumb rides continuously and only the
     readout is rounded, so it sat at 18.5 while showing 18 */
  useAnimatedReaction(
    () => Math.round(v.value),
    (cur, prev) => {
      if (cur !== prev) {
        runOnJS(setShown)(cur);
        if (onChange) runOnJS(onChange)(cur);
      }
    },
  );

  const knobY = useDerivedValue(() => yFor(v.value));
  const accent = accentFor(shown);
  const readoutColor = readoutTint(accent);

  /* Both states are drawn and crossfaded by opacity, which RN styles animate
     on the UI thread — react-native-svg will not animate fill/stroke, and
     driving them from React state would re-render on every press. */
  const press = useSharedValue(0);
  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = v.value;
      press.value = withTiming(1, { duration: PRESS_IN });
    })
    .onFinalize(() => {
      press.value = withTiming(0, { duration: PRESS_OUT });
    })
    .onUpdate((e) => {
      const next = start.value - e.translationY / (S * PX_PER_LB);
      v.value = Math.min(MAX, Math.max(MIN, next));
    });

  const line = useAnimatedProps(() => ({ d: trackPath(knobY.value) }));
  const fill = useAnimatedProps(() => ({ d: trackPath(knobY.value) }));
  /* mask gradient: black above the tail, white from the thumb down, so the
     accent fades into the grey track instead of ending on a hard edge */
  const tail = useAnimatedProps(() => ({
    y1: knobY.value - TAIL,
    y2: knobY.value,
  }));
  const majorTicks = useAnimatedProps(() => ({ d: ticksPath(knobY.value, true) }));
  const minorTicks = useAnimatedProps(() => ({ d: ticksPath(knobY.value, false) }));
  const leftRegion = useAnimatedProps(() => ({ d: leftOfLinePath(knobY.value) }));
  /* the glow is centred on the line at the thumb, so only cy moves */
  const glowAt = useAnimatedProps(() => ({ cy: knobY.value }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateY: (knobY.value - KNOB_R - KNOB_PAD - VIEW_Y) * S }],
  }));
  /* The readout is centred on the thumb — measured ink box y 201..279 against
     a thumb at 243, so the ink centre sits 3 above it. Half the line box would
     be 54; the extra 5 is the font's own descender asymmetry, which puts the
     ink centre above the box centre. */
  const bezelIn = useAnimatedStyle(() => ({ opacity: press.value }));
  const chevIdle = useAnimatedStyle(() => ({ opacity: 1 - press.value }));
  const chevHeld = useAnimatedStyle(() => ({ opacity: press.value }));
  const readout = useAnimatedStyle(() => ({
    transform: [{ translateY: (knobY.value - 49 - VIEW_Y) * S }],
  }));

  return (
    <GestureDetector gesture={pan}>
      {/* aspectRatio alone is not enough: with width 100% yoga clamps the
          HEIGHT via maxHeight but leaves the width, so on a short wide
          viewport the frame stretched to 1000x700. Capping the width by the
          available height keeps the ratio in both directions. */}
      <View
        style={[
          styles.root,
          { maxWidth: availH * (CANVAS_W / CANVAS_H) },
        ]}
        onLayout={onFrameLayout}
      >
        <Svg width="100%" height="100%"
             viewBox={`${VIEW_X} ${VIEW_Y} ${CANVAS_W} ${CANVAS_H}`}>
          <Defs>
            <AGradient
              id="tailGrad"
              gradientUnits="userSpaceOnUse"
              x1={0}
              x2={0}
              animatedProps={tail}
            >
              <Stop offset="0" stopColor="#000000" />
              <Stop offset="0.28" stopColor="#969696" />
              <Stop offset="0.45" stopColor="#DEDEDE" />
              <Stop offset="0.55" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#FFFFFF" />
            </AGradient>
            <Mask id="fillMask" maskUnits="userSpaceOnUse"
                  x={VIEW_X} y={VIEW_Y} width={CANVAS_W} height={CANVAS_H}>
              <Rect x={VIEW_X} y={VIEW_Y} width={CANVAS_W} height={CANVAS_H} fill="url(#tailGrad)" />
            </Mask>
            {/* the glow is shaped by a mask and coloured by the rect beneath
                it, so it tracks the accent — a fixed yellow here left the halo
                yellow while the line and readout had gone lime */}
            {/* The glow was three gaussian-blurred strokes. On iOS Safari an SVG
                filter is rasterised near the element's user space and then
                scaled up to the device, and this Svg is a 342-unit viewBox
                stretched to the full screen — so the falloff arrived as visible
                contour bands instead of a gradient, and re-blurring three
                passes every frame made the drag stutter. Desktop Chrome rasterises
                at device resolution, which is why it only showed on the phone.

                These gradients ARE the blur: each stop is the exact 1D profile
                of that stroke convolved with its own sigma, computed off
                erf((d±W/2)/(sigma*sqrt2)). Same curve, no filter, no
                per-frame raster, and identical on every browser. */}
            {/* Measured off the capture at 18 lbs: walking out from the thumb
                the haze reaches ~65px to the left and ~65px up and down, so it
                is one radial falloff centred on the line — a semicircle, the
                line itself being the flat side — rather than a sideways ramp
                crossed with a vertical envelope. Those two were separable and
                this is not, which is why the old shape read as a lit band and
                this reads as a lamp. Stops are the measured profile normalised
                against its own peak. */}
            <ARadial
              id="glowFall" gradientUnits="userSpaceOnUse"
              cx={GLOW_EDGE} r={GLOW_R}
              animatedProps={glowAt}
            >
              {/* No flat run at the middle. The profile was sampled from 10px
                  out, and carrying its first reading back to the centre as a
                  plateau painted a 10px disc at full opacity — which is the
                  hard bright circle sitting in the peak. It falls away from
                  zero instead, so the centre is the top of a curve rather than
                  the face of a disc. */}
              <Stop offset="0" stopColor={accent} stopOpacity={GLOW_PEAK} />
              <Stop offset="0.14" stopColor={accent} stopOpacity={GLOW_PEAK * 0.88} />
              <Stop offset="0.29" stopColor={accent} stopOpacity={GLOW_PEAK * 0.658} />
              <Stop offset="0.43" stopColor={accent} stopOpacity={GLOW_PEAK * 0.439} />
              <Stop offset="0.57" stopColor={accent} stopOpacity={GLOW_PEAK * 0.268} />
              <Stop offset="0.71" stopColor={accent} stopOpacity={GLOW_PEAK * 0.123} />
              <Stop offset="0.86" stopColor={accent} stopOpacity={GLOW_PEAK * 0.043} />
              <Stop offset="1" stopColor={accent} stopOpacity={0} />
            </ARadial>
            {/* The envelopes are centred on the thumb, so near either end of
                the ruler they run off the canvas and are cut by its edge — a
                bright band sitting against the top rather than a fade. This
                caps all three to the ruler's own span, feathered so the glow
                is still at full strength when the thumb is on the last mark. */}
            <LinearGradient
              id="edgeFadeGrad" gradientUnits="userSpaceOnUse"
              x1={0} y1={VIEW_Y} x2={0} y2={VIEW_Y + CANVAS_H}
            >
              {/* Black everywhere past the ruler, ramping to full across the
                  last few pixels before the end mark — so the thumb is still
                  fully lit on 0 and 36, and the haze is cut off by the end of
                  the instrument instead of hanging in the margin. */}
              <Stop offset="0" stopColor="#000000" />
              <Stop offset={`${(TRACK_TOP - VIEW_Y - GLOW_EDGE_FEATHER) / CANVAS_H}`} stopColor="#000000" />
              <Stop offset={`${(TRACK_TOP - VIEW_Y) / CANVAS_H}`} stopColor="#FFFFFF" />
              <Stop offset={`${(TRACK_BOT - VIEW_Y) / CANVAS_H}`} stopColor="#FFFFFF" />
              <Stop offset={`${(TRACK_BOT - VIEW_Y + GLOW_EDGE_FEATHER) / CANVAS_H}`} stopColor="#000000" />
              <Stop offset="1" stopColor="#000000" />
            </LinearGradient>
            <Mask id="edgeFade" maskUnits="userSpaceOnUse"
                  x={VIEW_X} y={VIEW_Y} width={CANVAS_W} height={CANVAS_H}>
              <Rect x={VIEW_X} y={VIEW_Y} width={CANVAS_W} height={CANVAS_H} fill="url(#edgeFadeGrad)" />
            </Mask>
            <ClipPath id="leftOfLine">
              <APath animatedProps={leftRegion} />
            </ClipPath>
          </Defs>

          {/* ruler: two paths so the bend can ride on the UI thread */}
          <APath
            animatedProps={minorTicks}
            stroke={TICK_MINOR} strokeWidth={1.4} fill="none" strokeLinecap="round"
          />
          <APath
            animatedProps={majorTicks}
            stroke={TICK_MAJOR} strokeWidth={2} fill="none" strokeLinecap="round"
          />

          {/* the glow sits over the ruler so the ticks near the thumb light up,
              and under the line so the line stays the brightest thing */}
          {/* Each pass is its falloff painted straight on, then clipped to the
              line and masked by the same vertical envelope as before — so the
              haze still stops dead at the line with nothing on the knob side,
              and still peaks at the thumb. */}
          {/* clipped so it stops dead at the line with nothing on the knob
              side, and capped so it cannot spill past either end of the ruler */}
          <G mask="url(#edgeFade)">
            <G clipPath="url(#leftOfLine)">
              <Rect x={VIEW_X} y={VIEW_Y} width={CANVAS_W} height={CANVAS_H} fill="url(#glowFall)" />
            </G>
          </G>

          <APath
            animatedProps={line}
            stroke={TRACK} strokeWidth={2.2} fill="none"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <APath
            animatedProps={fill}
            stroke={accent}
            strokeWidth={2.2} fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            mask="url(#fillMask)"
          />
        </Svg>

        {/* Knob. The rim runs light on the upper-left (+15 lum) into a deep
            shadow on the lower-right (-28), lit from the top-left, and the
            shadow carries on softly to r=40. The gradients live in THIS Svg:
            they were in the other one, which resolves on web only because ids
            are document-global there, and would have left the rim missing on
            native. */}
        <Animated.View style={[styles.knob, knob]}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${KNOB_BOX} ${KNOB_BOX}`}>
            <Defs>
              <LinearGradient id="rimLight" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#3C3D37" stopOpacity="1" />
                <Stop offset="0.55" stopColor="#3C3D37" stopOpacity="0" />
                <Stop offset="1" stopColor="#3C3D37" stopOpacity="0" />
              </LinearGradient>
              <LinearGradient id="rimShade" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="0.58" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            {/* Shadow depth by radius, read off the 315-degree spoke:
                lum 6 at r=31, 10 at 33, 14 at 35, 23 at 38, 30 at 40 against a
                page of 34 — deep at the edge and still visible 7px out, so it
                is four rings rather than one stroke. */}
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R + 7.5}
                    fill="none" stroke="url(#rimShade)" strokeWidth={4} opacity={0.1} />
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R + 5}
                    fill="none" stroke="url(#rimShade)" strokeWidth={3.6} opacity={0.22} />
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R + 2.4}
                    fill="none" stroke="url(#rimShade)" strokeWidth={3.4} opacity={0.45} />
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R} fill={PAGE} />
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R}
                    fill="none" stroke="url(#rimShade)" strokeWidth={2.2} opacity={0.9} />
            <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_R}
                    fill="none" stroke="url(#rimLight)" strokeWidth={1.8} />
          </Svg>

          {/* pressed: the lit bezel, r 22..30 peaking at 26, plus bright
              chevrons. A soft radial rather than a stroke, because the
              measured ring fades at both edges. */}
          <Animated.View style={[StyleSheet.absoluteFill, bezelIn]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${KNOB_BOX} ${KNOB_BOX}`}>
              <Defs>
                <RadialGradient id="bezel" cx="50%" cy="50%" r="50%">
                  <Stop offset="0.537" stopColor="#363736" stopOpacity="0" />
                  <Stop offset="0.634" stopColor="#363736" stopOpacity="1" />
                  <Stop offset="0.732" stopColor="#363736" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx={KNOB_BOX / 2} cy={KNOB_BOX / 2} r={KNOB_BOX / 2} fill="url(#bezel)" />
              <Polygon
                points={`${KNOB_BOX / 2},${KNOB_BOX / 2 - 14} ${KNOB_BOX / 2 - 5.5},${KNOB_BOX / 2 - 3} ${KNOB_BOX / 2 + 5.5},${KNOB_BOX / 2 - 3}`}
                fill={CHEVRON_ACTIVE}
              />
              <Polygon
                points={`${KNOB_BOX / 2},${KNOB_BOX / 2 + 14} ${KNOB_BOX / 2 - 5.5},${KNOB_BOX / 2 + 3} ${KNOB_BOX / 2 + 5.5},${KNOB_BOX / 2 + 3}`}
                fill={CHEVRON_ACTIVE}
              />
            </Svg>
          </Animated.View>

          {/* at rest: no ring at all, and the chevrons sit at 72 not 170 */}
          <Animated.View style={[StyleSheet.absoluteFill, chevIdle]}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${KNOB_BOX} ${KNOB_BOX}`}>
              <Polygon
                points={`${KNOB_BOX / 2},${KNOB_BOX / 2 - 12.5} ${KNOB_BOX / 2 - 5},${KNOB_BOX / 2 - 3.5} ${KNOB_BOX / 2 + 5},${KNOB_BOX / 2 - 3.5}`}
                fill={CHEVRON_IDLE}
              />
              <Polygon
                points={`${KNOB_BOX / 2},${KNOB_BOX / 2 + 12.5} ${KNOB_BOX / 2 - 5},${KNOB_BOX / 2 + 3.5} ${KNOB_BOX / 2 + 5},${KNOB_BOX / 2 + 3.5}`}
                fill={CHEVRON_IDLE}
              />
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* ruler labels: white, dimmed by distance from the thumb. "lbs" is
            exempt — it stayed full white 204px away from the thumb */}
        {LABELS.map((n) => (
          <RulerLabel key={n} value={n} knobY={knobY} styles={styles} scale={S} />
        ))}
        <RulerLabel
          value={0} text="lbs" fixedOpacity={0.98} fixedScale
          knobY={knobY} styles={styles} scale={S}
        />

        <AText style={[styles.readout, readout, { color: readoutColor }]}>{shown}</AText>
      </View>
    </GestureDetector>
  );
}

function RulerLabel({
  value, text, fixedOpacity, fixedScale, knobY, styles, scale,
}: {
  value: number;
  text?: string;
  fixedOpacity?: number;
  fixedScale?: boolean;
  knobY: SharedValue<number>;
  styles: ReturnType<typeof sheet>;
  scale: number;
}) {
  const y = TRACK_BOT - value * PX_PER_LB;
  const style = useAnimatedStyle(() => {
    const d = Math.abs(y - knobY.value);
    /* same curve as the bend, so the label the thumb is on grows to 1.5x and
       is back to normal a major step away — measured 27 glyph rows against 18 */
    const t = Math.min(1, d / LABEL_W);
    /* "lbs" does not take part: the growth was measured on the numeric
       labels, and being three characters wide it runs off the left edge at
       1.45x when the thumb sits on 0. It is already exempt from the opacity
       ramp for the same reason — it stayed full white 204px away. */
    const near = fixedScale ? 0 : 0.5 * (1 + Math.cos(Math.PI * t));
    return {
      /* Measured across every frame, alpha by distance runs .67/.51/.48/.37/
         .30/.23/.17/.15 out to 190 and then falls off a cliff to .01 — so the
         labels hold a low level for most of the ruler and then go out
         entirely. That cliff is what makes the bottom labels disappear when
         the thumb is at the top and vice versa; an exponential with a floor
         never gets there, so the cutoff is explicit.

         They are NOT blurred in the capture: normalising each label's edge
         gradient by its own amplitude gives .82/.75/.69/.78/1.00 across the
         range, so sharpness does not fall with distance. Only brightness. */
      opacity:
        fixedOpacity ??
        (0.1 + 0.57 * Math.exp(-d / 70)) *
          Math.min(1, Math.max(0, (LABEL_OUT - d) / LABEL_OUT_FADE)),
      transform: [
        { translateX: -bendAt(y, knobY.value, RULER_A) * scale },
        { scale: 1 + LABEL_GROW * near },
      ],
    };
  });
  return (
    <AText style={[styles.label, { top: (y - 13 - VIEW_Y) * scale }, style]}>
      {text ?? value}
    </AText>
  );
}

const sheet = (S: number) => StyleSheet.create({
  root: {
    width: '100%',
    aspectRatio: CANVAS_W / CANVAS_H,
    maxHeight: '100%',
    alignSelf: 'center',
    backgroundColor: PAGE,
  },
  knob: {
    position: 'absolute',
    left: (KNOB_CX - KNOB_R - KNOB_PAD - VIEW_X) * S,
    top: 0,
    width: KNOB_BOX * S,
    height: KNOB_BOX * S,
  },
  label: {
    position: 'absolute',
    left: 0,
    width: (LABEL_RIGHT - VIEW_X) * S,
    textAlign: 'right',
    transformOrigin: 'right center',
    color: '#FFFFFF',
    fontSize: 26 * S,
    /* the capture's ruler stems measure 2px on an 18px cap height (.111),
       which is about a 400 in the system face. Set two steps under that:
       against the reference these read as thin as the readout, which is a 200,
       rather than the semi they were drifting toward. */
    lineHeight: 26 * S,
    fontWeight: '200',
  },
  readout: {
    position: 'absolute',
    left: (NUMBER_LEFT - VIEW_X) * S,
    top: 0,
    fontSize: 108 * S,
    lineHeight: 108 * S,
    /* the capture's strokes are 7px on a 79px cap height */
    fontWeight: '200',
    letterSpacing: -2 * S,
  },
});
