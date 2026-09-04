/* ---------------------------------------------------------------------------
   PXDX Sketch Book — gooey cards.

   A port of the reference capture (672 x 848, 30fps) to React Native, driven by
   the gesture. The web original in reference/pxdx-gooey-cards replayed a
   scripted pointer; here the finger is the only thing that moves it, and the
   physics it feeds is the same one, fitted off the capture:

   * There is ONE black metaball for the whole stage. It trails the pointer and
     lives in the same `filter="url(#goo)"` group as the two discs behind the
     photographs, so it melts into whichever disc it is closest to — and when
     the pointer crosses from one card to the other you watch it stretch off the
     first card, fly across the gap, and get absorbed into the second.
   * Sitting out by a card's rim it reads as an extruded lobe carrying the
     cursor dot and the arrow. Parked over the centre it hides under the disc
     and all you see is the black ring opened up by the photo scaling down.
   * Everything eases with a plain exponential approach — never a timed
     animation — so the motion is framerate independent and the pointer can
     change its mind mid-flight.

   Nothing here is on a timeline. Each frame carries the state a fraction of the
   way toward wherever the finger already is, so the finger's own speed is the
   animation's speed: stop and it comes to rest where it stopped, go back and it
   follows back, and the same path travelled fast or slow rests in the same
   place. See scripts/gooey-gesture.mjs, which asserts exactly that.

   The simulation runs in one `useFrameCallback` on the UI thread, parked as
   soon as there is nothing left to integrate and re-armed by the next touch.
   Its state lives in a single shared value reassigned wholesale each frame: a
   nested write into a shared value's object is not guaranteed to persist, and
   an integrator that loses its writes silently never moves at all.
--------------------------------------------------------------------------- */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Image, Text, StyleSheet, useWindowDimensions, Platform, TextInput,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, useFrameCallback,
  useAnimatedReaction, runOnJS,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, {
  Defs, Filter, FeGaussianBlur, FeColorMatrix, G, Circle, Path, Pattern, Rect,
} from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { mono } from '../theme';
import {
  DESIGN, PAPER, INK, DOT, DOT_PITCH, DOT_R, DOT_AT,
  DISC_R, BALL_R, RING, PILL_H, PILL_Y, CHIP_H, CHIP_MIN_W,
  CHIP_IDLE_BG, CHIP_IDLE_FG, CARDS, META_ID, META_LINES,
  TRANSFER, priceLabel, deltaLabel,
} from '../gooey/constants';
import type { CardSpec } from '../gooey/constants';
import { initialState, step } from '../gooey/step';
import type { State, Pointer } from '../gooey/step';
import { clamp, lerp, mixRgb, rgbStr } from '../gooey/sim';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedInput = Animated.createAnimatedComponent(TextInput);

const AVATARS = [
  require('../../assets/gooey/avatar-01.png'),
  require('../../assets/gooey/avatar-02.png'),
];

/* The chip opens to fit its own label: the original measured '-56' at 11px/600
   as 30px and added 10px of padding, which is the 10px-a-character below. A
   four-character delta needs the extra room. */
const chipWide = (label: string) => Math.max(CHIP_MIN_W, label.length * 10 + 10);

export default function GooeyScreen() {
  const win = useWindowDimensions();

  /* the stage is authored at 672 x 848 and scaled uniformly, never reflowed */
  const scale = Math.min((win.width * 0.96) / DESIGN.w, (win.height * 0.96) / DESIGN.h);
  const offX = (win.width - DESIGN.w * scale) / 2;
  const offY = (win.height - DESIGN.h * scale) / 2;

  /* One shared value holding the whole state. Reassigned wholesale each frame
     rather than written field by field: a nested write into a shared value's
     object is not guaranteed to persist, which silently freezes the loop. */
  const st = useSharedValue<State>(initialState());

  /* Where the finger is, in stage units, written from the JS thread by the
     handlers below. `on` is a pointer being present at all — a hover on
     desktop, a finger held down on touch. */
  const pointerX = useSharedValue(0);
  const pointerY = useSharedValue(0);
  const pointerOn = useSharedValue(0);
  const idle = useSharedValue(0);
  const fresh = useSharedValue(0);   // a new gesture has begun

  /* --- frame -------------------------------------------------------------- */

  /* The gesture is the only thing that drives this. Nothing here runs on a
     clock: each frame moves the state a fraction of the way toward wherever the
     finger already is, so it tracks the finger's own speed — stopping where it
     stops, and reversing when it comes back. */
  const loop = useFrameCallback((info) => {
    /* clamped low as well as high: a backwards clock must never feed a negative
       dt into the approach() terms, which would blow them up */
    const dt = clamp((info.timeSincePreviousFrame ?? 16.7) / 1000, 0, 1 / 20);

    const s = st.value;
    /* a fresh object, so the copy the styles read is never a half-stepped one */
    const next: State = {
      ballX: s.ballX, ballY: s.ballY, ballScale: s.ballScale,
      reveal: s.reveal, awake: s.awake,
      act: [s.act[0], s.act[1]],
      pill: [s.pill[0], s.pill[1]],
      pushX: [s.pushX[0], s.pushX[1]],
      pushY: [s.pushY[0], s.pushY[1]],
      count: [s.count[0], s.count[1]],
      vx: s.vx, vy: s.vy,
      pushVX: [s.pushVX[0], s.pushVX[1]],
      pushVY: [s.pushVY[0], s.pushVY[1]],
      values: [s.values[0], s.values[1]],
      holder: s.holder, active: s.active, done: s.done, doneFor: s.doneFor,
    };

    /* A landed throw finishes the piece: the ring closes, the pill goes with it
       and the blob sinks away, whether or not the finger is still down. It
       stays down until a new gesture picks it up, which is what clears `done`.

       Short of that, lifting off settles onto the card the gesture aimed at —
       the bubble trails the finger, so letting go over the far card has to
       carry it the rest of the way in rather than pull it home, or a quick
       flick would undo itself. A gesture that never reached a card eases all
       the way back down on its own. */
    if (fresh.value === 1) { next.done = false; next.doneFor = 0; fresh.value = 0; }

    let ptr: Pointer = null;
    if (!next.done) {
      if (pointerOn.value === 1) ptr = { x: pointerX.value, y: pointerY.value };
      else if (next.active >= 0) ptr = { x: CARDS[next.active].cx, y: CARDS[next.active].cy };
    }

    step(next, dt, ptr);
    st.value = next;

    /* Park the loop once it has nothing left to integrate, rather than idling
       at sixty frames a second on a piece that has stopped. */
    const moved =
      Math.abs(next.ballX - s.ballX) + Math.abs(next.ballY - s.ballY) +
      Math.abs(next.ballScale - s.ballScale) + Math.abs(next.awake - s.awake) +
      Math.abs(next.reveal - s.reveal) +
      Math.abs(next.pill[0] - s.pill[0]) + Math.abs(next.pill[1] - s.pill[1]) +
      Math.abs(next.count[0] - s.count[0]) + Math.abs(next.count[1] - s.count[1]) +
      Math.abs(next.pushX[0] - s.pushX[0]) + Math.abs(next.pushX[1] - s.pushX[1]) +
      Math.abs(next.pushY[0] - s.pushY[0]) + Math.abs(next.pushY[1] - s.pushY[1]);
    idle.value = pointerOn.value === 0 && moved < 1e-3 ? 1 : 0;
  }, false);

  const stop = useCallback(() => loop.setActive(false), [loop]);
  useAnimatedReaction(
    () => idle.value,
    (v, prev) => { if (v === 1 && prev !== 1) runOnJS(stop)(); },
    [stop],
  );

  /* --- pointer ------------------------------------------------------------ */

  const arm = useCallback(() => {
    idle.value = 0;
    loop.setActive(true);
  }, [idle, loop]);

  /* Coordinates arrive relative to the view this detector wraps, which is the
     untransformed root — so the letterbox and the stage scale are the only two
     things between a finger and stage units. Nothing here goes through window
     coordinates, page scroll, or the device pixel ratio, and the stage's own
     `scale` transform is divided out rather than measured. */
  const toStage = (x: number, y: number) => {
    'worklet';
    pointerX.value = (x - offX) / scale;
    pointerY.value = (y - offY) / scale;
    pointerOn.value = 1;
  };

  /* A pan rather than the View's pointer props: React Native does not implement
     onPointerMove for native views (it is a react-native-web affordance), so on
     a real device those handlers never fire and the piece would sit dead under
     the finger. This runs on the UI thread on both. minDistance(0) so the blob
     answers the touch itself, not the first few pixels of travel. */
  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      fresh.value = 1;
      toStage(e.x, e.y);
      runOnJS(arm)();
    })
    .onUpdate((e) => {
      'worklet';
      toStage(e.x, e.y);
    })
    /* covers a lifted finger and a cancelled gesture alike */
    .onFinalize(() => {
      'worklet';
      pointerOn.value = 0;
      runOnJS(arm)();
    }),
  [arm, offX, offY, scale, pointerX, pointerY, pointerOn, fresh]);

  /* Desktop hover, which has no gesture to begin. Ignored on native, where
     these props do not exist.

     Guarded on both counts: a pressed pointer belongs to the pan above, and an
     event carrying no usable coordinates must never reach the simulation — one
     NaN in the pointer poisons every value it eases, permanently. */
  const track = useCallback((e: any) => {
    const n = e?.nativeEvent;
    if (n?.buttons) return;
    const x = n?.locationX;
    const y = n?.locationY;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (pointerOn.value === 0) fresh.value = 1;
    pointerX.value = (x - offX) / scale;
    pointerY.value = (y - offY) / scale;
    pointerOn.value = 1;
    arm();
  }, [pointerX, pointerY, pointerOn, fresh, arm, offX, offY, scale]);

  const release = useCallback(() => {
    pointerOn.value = 0;
    arm();
  }, [pointerOn, arm]);

  useEffect(() => () => loop.setActive(false), [loop]);

  /* --- the liquid layer --------------------------------------------------- */

  const disc0Props = useAnimatedProps(() => ({
    cx: CARDS[0].cx + st.value.pushX[0],
    cy: CARDS[0].cy + st.value.pushY[0],
  }));
  const disc1Props = useAnimatedProps(() => ({
    cx: CARDS[1].cx + st.value.pushX[1],
    cy: CARDS[1].cy + st.value.pushY[1],
  }));
  const ballProps = useAnimatedProps(() => ({
    cx: st.value.ballX,
    cy: st.value.ballY,
    r: Math.max(0.01, BALL_R * st.value.ballScale),
  }));

  /* --- dot + arrow, riding on the ball ------------------------------------ */

  /* The dot and arrow read as "carry it that way", so the arrow has to face
     the side the blob is being pulled out to — right off the left avatar, left
     off the right one. Mirroring the whole group about the dot puts the arrow
     on the correct side of it as well as turning the glyph round; the dot is
     round, so it is unchanged by the flip. The change lands while the group is
     blurred out mid-throw, so the turn is never seen. */
  const ballContentStyle = useAnimatedStyle(() => {
    const s = st.value;
    const home = s.holder >= 0 ? CARDS[s.holder].cx : CARDS[0].cx;
    return {
      opacity: s.reveal,
      transform: [
        { translateX: s.ballX },
        { translateY: s.ballY },
        { scaleX: s.ballX < home ? -1 : 1 },
      ],
      ...blurStyle((1 - s.reveal) * 5),
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.root}
        onPointerMove={track}
        onPointerLeave={release}
      >
        <View style={[styles.stage, { transform: [{ scale }] }]}>
          <DotPaper />

          {/* the liquid layer: two discs and the ball, blurred together and
              hard-thresholded back into a crisp silhouette */}
          <Svg
            width={DESIGN.w}
            height={DESIGN.h}
            viewBox={`0 0 ${DESIGN.w} ${DESIGN.h}`}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <Filter
                id="goo"
                x="-6%" y="-8%" width="112%" height="116%"
                primitiveUnits="userSpaceOnUse"
                {...({ colorInterpolationFilters: 'sRGB' } as any)}
              >
                <FeGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <FeColorMatrix
                  in="blur"
                  type="matrix"
                  result="goo"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
                />
              </Filter>
            </Defs>
            <G filter="url(#goo)">
              <AnimatedCircle animatedProps={disc0Props} r={DISC_R} fill={INK} />
              <AnimatedCircle animatedProps={disc1Props} r={DISC_R} fill={INK} />
              <AnimatedCircle animatedProps={ballProps} fill={INK} />
            </G>
          </Svg>

          <Card spec={CARDS[0]} index={0} st={st} />
          <Card spec={CARDS[1]} index={1} st={st} />

          <Animated.View style={[styles.ballContent, ballContentStyle]}>
            <View style={styles.cursorDot} />
            <Svg width={13.5} height={8} viewBox="0 0 24 14" style={styles.arrow}>
              <Path
                d="M0 7h21M15 1l6 6-6 6"
                fill="none"
                stroke="#fff"
                strokeWidth={1.9}
                strokeLinecap="square"
                strokeLinejoin="miter"
              />
            </Svg>
          </Animated.View>

          <View style={styles.meta}>
            <Text style={styles.metaText}>{META_ID}</Text>
            <View>
              {META_LINES.map((l) => <Text key={l} style={styles.metaText}>{l}</Text>)}
            </View>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

/* --- card (photo + pill) -------------------------------------------------- */

function Card({ spec, index, st }: {
  spec: CardSpec;
  index: number;
  st: SharedValue<State>;
}) {
  /* The black border is not drawn — it is the disc showing through as the
     photograph scales down. It belongs to the piece rather than to either card,
     so it opens while the pointer is anywhere on the stage. */
  const photoStyle = useAnimatedStyle(() => {
    const s = st.value;
    return {
      transform: [
        { translateX: s.pushX[index] },
        { translateY: s.pushY[index] },
        { scale: 1 - (1 - RING) * s.awake },
      ],
    };
  });

  const pillStyle = useAnimatedStyle(() => {
    const v = st.value.pill[index];
    return {
      opacity: v,
      transform: [
        { translateX: '-50%' },
        { translateY: '-50%' },
        { scale: 0.86 + 0.14 * v },
      ],
      ...blurStyle((1 - v) * 7),
    };
  });

  /* the chip hatches out of a circle as the counter fills in */
  const target = TRANSFER;
  /* both signs are the same width, so the chip does not resize when they swap */
  const wide = chipWide(deltaLabel(index, index, target));
  const chipStyle = useAnimatedStyle(() => {
    const p = target ? clamp(st.value.count[index] / target, 0, 1) : 0;
    return {
      width: lerp(CHIP_MIN_W, wide, clamp(p * 1.35, 0, 1)),
      backgroundColor: rgbStr(mixRgb(CHIP_IDLE_BG, spec.chipBg, p)),
    };
  });

  const chipTextStyle = useAnimatedStyle(() => {
    const p = target ? clamp(st.value.count[index] / target, 0, 1) : 0;
    return {
      color: rgbStr(mixRgb(CHIP_IDLE_FG, spec.chipFg, p)),
      opacity: clamp(p * 3.2 - 0.25, 0, 1),
    };
  });

  /* What the card is holding only changes when a throw lands, so it comes back
     to React rather than being written every frame — a TextInput here would
     also refuse to shrink to its content and stretch the pill. */
  const [holding, setHolding] = useState(CARDS[index].value);
  useAnimatedReaction(
    () => st.value.values[index],
    (v, prev) => { if (prev !== null && v !== prev) runOnJS(setHolding)(v); },
    [index],
  );

  const chipProps = useAnimatedProps(() => ({
    text: deltaLabel(index, st.value.holder, Math.round(st.value.count[index])),
  }) as any);

  return (
    <View style={[styles.card, { left: spec.cx, top: spec.cy }]}>
      <Animated.View style={[styles.photo, photoStyle]}>
        <Image source={AVATARS[index]} style={styles.photoImg} resizeMode="cover" />
      </Animated.View>

      <Animated.View style={[styles.pill, pillStyle]}>
        <Text style={styles.price}>{priceLabel(holding)}</Text>
        <Animated.View style={[styles.chip, chipStyle]}>
          <AnimatedInput
            editable={false}
            defaultValue={deltaLabel(index, -1, 0)}
            animatedProps={chipProps}
            style={[styles.chipText, chipTextStyle]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/* --- dotted paper --------------------------------------------------------- */

/* One tile repeated by an SVG pattern. Emitting a circle per dot is ~8,700
   nodes at this pitch, which the compositor has to walk on every frame. */
function DotPaper() {
  return (
    <Svg
      width={DESIGN.w}
      height={DESIGN.h}
      viewBox={`0 0 ${DESIGN.w} ${DESIGN.h}`}
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <Pattern
          id="paper-dots"
          width={DOT_PITCH}
          height={DOT_PITCH}
          patternUnits="userSpaceOnUse"
        >
          <Circle cx={DOT_AT} cy={DOT_AT} r={DOT_R} fill={DOT} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={DESIGN.w} height={DESIGN.h} fill="url(#paper-dots)" />
    </Svg>
  );
}

/* --- helpers -------------------------------------------------------------- */

/* RN takes `filter` as an array of filter functions, the DOM as a string.
   Reanimated writes web styles straight onto the node, so the two have to be
   spelled differently; below ~0.05px it is not worth compositing at all. */
function blurStyle(px: number) {
  'worklet';
  if (px < 0.05) return {};
  return Platform.OS === 'web'
    ? { filter: `blur(${px.toFixed(2)}px)` }
    : { filter: [{ blur: px }] };
}

const DISC = DISC_R * 2;
const PHOTO_OVER = 1.025;   // background-size: 102.5%

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' },

  stage: { width: DESIGN.w, height: DESIGN.h, backgroundColor: PAPER, overflow: 'hidden' },

  card: { position: 'absolute', width: 0, height: 0 },

  photo: {
    position: 'absolute',
    left: -DISC_R, top: -DISC_R,
    width: DISC, height: DISC,
    borderRadius: DISC_R,
    overflow: 'hidden',
  },
  photoImg: {
    width: DISC * PHOTO_OVER,
    height: DISC * PHOTO_OVER,
    marginLeft: (-DISC * (PHOTO_OVER - 1)) / 2,
    marginTop: (-DISC * (PHOTO_OVER - 1)) / 2,
  },

  pill: {
    position: 'absolute',
    top: PILL_Y,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: PILL_H,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: PILL_H / 2,
    backgroundColor: INK,
  },
  price: { fontSize: 16, fontWeight: '500', letterSpacing: -0.2, color: '#fff' },

  chip: {
    height: CHIP_H,
    borderRadius: CHIP_H / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
    textAlign: 'center',
    padding: 0,
    width: '100%',
    ...(Platform.OS === 'web' ? { borderWidth: 0, outlineStyle: 'none' as any } : null),
  },

  ballContent: {
    position: 'absolute',
    left: -3.75, top: -7,
    /* The group is mirrored to turn the arrow round, and the dot is what sits
       on the ball's centre — so that is what the mirror has to pivot about,
       or the dot swings off the blob by half the group's width. */
    transformOrigin: '3.75px 7px',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7.2,
    height: 14,
  },
  cursorDot: { width: 7.5, height: 7.5, borderRadius: 3.75, backgroundColor: '#fff' },
  arrow: { overflow: 'visible' },

  meta: {
    position: 'absolute',
    left: 23,
    bottom: 20,
    flexDirection: 'row',
    gap: 16,
  },
  metaText: {
    fontFamily: mono,
    fontSize: 8,
    lineHeight: 12.2,
    letterSpacing: 0.7,
    color: 'rgba(0,0,0,0.13)',
  },
});
