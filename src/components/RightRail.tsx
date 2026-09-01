import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { colors, u } from '../theme';

/* Right-edge tab, measured off perspective-corrected frames of the capture in
   430x932 reference units, with the timings read frame by frame at 30fps.

   SHAPE — two slabs, not one. The steep 45-degree runs at the very top and
   bottom of the left-edge profile belong to a NARROWER, TALLER slab sitting
   behind (33 x 267, y 529 -> 796); the wider front slab (43 x 226,
   y 557 -> 783) only takes the silhouette over once its edge passes x 397, so
   the back one juts out past it at each end. Both are the same black —
   sampling across the tab gives 0-7 everywhere — so the pair reads purely as
   a stepped silhouette. The corners are chamfered but not knife-sharp: the
   profile eases over ~10 units at each turn, so every vertex carries a small
   radius.

   TIMING — the tab is not there at 1.07 and first breaks the edge at ~1.08.
   It does NOT snap open: growth is a long ease-out that is still creeping at
   2.3 and only lands at ~2.6 (sy 0.84 by 1.30 but 0.93 at 1.60, 0.97 at 2.00,
   1.00 at 2.57). Width trails height throughout. The marks then come up in
   their own order: camera 1.47, reticle 1.77, folder 1.80 — and the folder
   swells rather than fades, its area reaching full at ~2.3. */
/* TWO parts, and I had to average five corrected frames to see it properly.
   The left edge is not one line: below the top chamfer it holds a plateau at
   x 395 (y 555-573), then steps out again to x 387 (y 593-737), then returns
   to 395 (y 739-760) before the bottom chamfer. Two overlapping shapes, both
   chamfered at 45 degrees:

     REAR   narrower but taller — x 395-430 (35 wide), y 524-793 (269)
     FRONT  wider but shorter   — x 387-430 (43 wide), y 540-779 (239)

   Each 45-degree chamfer was solved for its own origin against the averaged
   profile rather than eyeballed; the rear's three samples agree to 0.2.

   So the rear is proud by 16 above and 14 below, and the plateaus are simply
   where the front has not yet reached and the rear is all you can see. My
   earlier single-trapezoid reading mistook those plateaus for corner
   rounding. */
const W = 43;                   // front, the wider one
const BACK_W = 35;              // rear, narrower
const SLOT_TOP = 524;           // rear's top, absolute
const H = 269;                  // rear: 524 -> 793
const FRONT_TOP = 16;           // front: 540 -> 779 absolute
const FRONT_H = 239;
const MARKS = [83, 139, 195];   // 607 / 663 / 719 absolute, unchanged
const FRONT_R = 6;
const BACK_R = 4;

/* measured growth. Height leads width the whole way, and the tail is long —
   this is what makes it read as opening rather than popping. */
const KEYS    = [1.06, 1.13, 1.20, 1.30, 1.45, 1.60, 1.80, 2.00, 2.30, 2.60];
const SCALE_Y = [   0, 0.40, 0.61, 0.84, 0.89, 0.93, 0.95, 0.97, 0.98, 1.00];
const SCALE_X = [   0, 0.10, 0.22, 0.60, 0.77, 0.86, 0.92, 0.96, 0.99, 1.00];

const DIM = '#6B6B70';

type Pt = { x: number; y: number };

/** polygon with a small radius rolled onto every corner */
function roundedPath(pts: Pt[], r: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const d1 = Math.hypot(prev.x - cur.x, prev.y - cur.y);
    const d2 = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(r, d1 / 2, d2 / 2);
    const a = { x: cur.x + ((prev.x - cur.x) / d1) * rr, y: cur.y + ((prev.y - cur.y) / d1) * rr };
    const b = { x: cur.x + ((next.x - cur.x) / d2) * rr, y: cur.y + ((next.y - cur.y) / d2) * rr };
    d += `${i === 0 ? 'M' : 'L'}${a.x.toFixed(2)} ${a.y.toFixed(2)} `;
    d += `Q${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)} `;
  }
  return d + 'Z';
}

const BACK_PATH = roundedPath([
  { x: W, y: 0 }, { x: W - BACK_W, y: BACK_W },
  { x: W - BACK_W, y: H - BACK_W }, { x: W, y: H },
], BACK_R);
const FRONT_PATH = roundedPath([
  { x: W, y: FRONT_TOP }, { x: 0, y: FRONT_TOP + W },
  { x: 0, y: FRONT_TOP + FRONT_H - W }, { x: W, y: FRONT_TOP + FRONT_H },
], FRONT_R);

export default function RightRail({ at }: { at?: number }) {
  const T = useSharedValue(at ?? 0);

  useEffect(() => {
    if (at !== undefined) { T.value = at; return; }
    T.value = withTiming(2.7, { duration: 2700, easing: Easing.linear });
  }, [T, at]);

  /* the tab grows out of the screen edge, so that edge must stay pinned:
     scaling about the centre is undone by half the width it just lost */
  const panel = useAnimatedStyle(() => {
    const sx = interpolate(T.value, KEYS, SCALE_X, Extrapolation.CLAMP);
    const sy = interpolate(T.value, KEYS, SCALE_Y, Extrapolation.CLAMP);
    return {
      opacity: T.value >= 1.06 ? 1 : 0,
      transform: [{ translateX: (u(W) / 2) * (1 - sx) }, { scaleX: sx }, { scaleY: sy }],
    };
  });

  const camera = useAnimatedStyle(() => ({
    opacity: interpolate(T.value, [1.47, 1.85], [0, 1], Extrapolation.CLAMP),
  }));
  const reticle = useAnimatedStyle(() => ({
    opacity: interpolate(T.value, [1.77, 2.10], [0, 1], Extrapolation.CLAMP),
  }));
  /* the folder does not fade — its area grows, so scale follows sqrt(area) */
  const folder = useAnimatedStyle(() => {
    const s = interpolate(T.value, [1.80, 1.90, 2.00, 2.10, 2.20, 2.30],
                                   [0, 0.57, 0.77, 0.86, 0.94, 1], Extrapolation.CLAMP);
    return { opacity: s > 0.02 ? 1 : 0, transform: [{ scale: s }] };
  });

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Animated.View style={[styles.panel, panel]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
          {/* rear first: narrower, taller, proud at both ends */}
          <Path d={BACK_PATH} fill={colors.panel} />
          <Path d={FRONT_PATH} fill={colors.panel} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.mark, { top: u(MARKS[0] - 9) }, reticle]}>
        <Svg width={u(18)} height={u(18)} viewBox="0 0 24 24">
          <Path
            d="M3 8.4V3.4h5M21 8.4V3.4h-5M3 15.6v5h5M21 15.6v5h-5"
            stroke={DIM} strokeWidth="2.8" fill="none" strokeLinecap="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.mark, { top: u(MARKS[1] - 8) }, folder]}>
        <Svg width={u(21)} height={u(16)} viewBox="0 0 24 18">
          <Path
            d="M2.4 2 L8.8 2 L11.2 4.8 L21.6 4.8 A1.2 1.2 0 0 1 22.8 6 L22.8 14.8
               A1.2 1.2 0 0 1 21.6 16 L2.4 16 A1.2 1.2 0 0 1 1.2 14.8 L1.2 3.2
               A1.2 1.2 0 0 1 2.4 2 Z"
            fill={colors.white}
          />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.mark, { top: u(MARKS[2] - 9.5) }, camera]}>
        <Svg width={u(19)} height={u(19)} viewBox="0 0 24 24">
          <Rect x="3" y="5.6" width="18" height="13.6" rx="2.4" stroke={DIM} strokeWidth="2.3" fill="none" />
          <Circle cx="12" cy="12.4" r="3.3" stroke={DIM} strokeWidth="2.3" fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    right: 0,
    top: u(SLOT_TOP),
    width: u(W),
    height: u(H),
    zIndex: 20,
  },
  panel: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  mark: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
