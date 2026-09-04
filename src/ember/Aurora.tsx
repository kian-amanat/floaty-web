/* ---------------------------------------------------------------------------
   The haze behind the screen.

   Four soft masses drifting slowly and leaning toward the finger — three high,
   where the heading sits, and one low so the foot of the screen is not dead
   flat black. The movement *is* the blur moving — no particles, nothing rising
   through the frame — so the background reads as light shifting behind the
   surface rather than as something animating on top of it.

   Each mass drifts on its own period and leans by its own amount, which is what
   keeps the field from sliding around as one sheet. The lean uses the same
   exponential approach as the rest of the project: it tracks the finger's own
   speed and runs on no timeline.
--------------------------------------------------------------------------- */

import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useFrameCallback, useDerivedValue,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, {
  Defs, Filter, FeGaussianBlur, RadialGradient, LinearGradient, Stop, Rect, Circle, G,
} from 'react-native-svg';

import { c } from './tokens';

export type Field = {
  x: SharedValue<number>;
  y: SharedValue<number>;
  on: SharedValue<number>;
};

export function useField(): Field {
  return { x: useSharedValue(0.5), y: useSharedValue(0.3), on: useSharedValue(0) };
}

const TAU_LEAN = 0.85;

/* Kept high and dim. The accent is for the controls; down here it is only
   meant to keep the black from going flat. */
const MASS = [
  { kx: 0.20, ky: 0.10, r: 0.72, lean: 46, period: 23, hue: c.hot, a: 0.44 },
  { kx: 0.88, ky: 0.20, r: 0.58, lean: 28, period: 31, hue: c.hotSoft, a: 0.30 },
  { kx: 0.55, ky: 0.02, r: 0.50, lean: 62, period: 27, hue: c.hotDeep, a: 0.38 },
  /* one low ember, so the foot of the screen is not dead flat black */
  { kx: 0.30, ky: 0.86, r: 0.52, lean: 20, period: 37, hue: c.hotDeep, a: 0.16 },
];

export default function Aurora({ field, intro }: { field: Field; intro: SharedValue<number> }) {
  const { width: W, height: H } = useWindowDimensions();

  const leanX = useSharedValue(0);
  const leanY = useSharedValue(0);
  const clock = useSharedValue(0);

  useFrameCallback((info) => {
    const dt = Math.min(Math.max((info.timeSincePreviousFrame ?? 16.7) / 1000, 0), 1 / 20);
    clock.value += dt;
    const aimX = field.on.value ? field.x.value - 0.5 : 0;
    const aimY = field.on.value ? field.y.value - 0.35 : 0;
    const k = 1 - Math.exp(-dt / TAU_LEAN);
    leanX.value += (aimX - leanX.value) * k;
    leanY.value += (aimY - leanY.value) * k;
  }, true);

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="base" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.bgLift} />
            <Stop offset="0.6" stopColor={c.bg} />
            <Stop offset="1" stopColor="#08080A" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#base)" />
      </Svg>

      {MASS.map((m, i) => (
        <Mass key={i} m={m} i={i} W={W} H={H} leanX={leanX} leanY={leanY} clock={clock} intro={intro} />
      ))}

      {/* keeps the haze in the upper third and the form on near-black */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#08080A" stopOpacity={0.04} />
            <Stop offset="0.34" stopColor="#08080A" stopOpacity={0.44} />
            <Stop offset="0.62" stopColor="#08080A" stopOpacity={0.87} />
            <Stop offset="0.88" stopColor="#08080A" stopOpacity={0.94} />
            <Stop offset="1" stopColor="#08080A" stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={W} height={H} fill="url(#scrim)" />
      </Svg>
    </View>
  );
}

function Mass({
  m, i, W, H, leanX, leanY, clock, intro,
}: {
  m: typeof MASS[number]; i: number; W: number; H: number;
  leanX: SharedValue<number>; leanY: SharedValue<number>;
  clock: SharedValue<number>; intro: SharedValue<number>;
}) {
  const size = W * m.r * 2;

  const drift = useDerivedValue(() => {
    const a = (clock.value * Math.PI * 2) / m.period;
    return { x: Math.sin(a) * 34, y: Math.cos(a * 0.67) * 24 };
  });

  const style = useAnimatedStyle(() => ({
    opacity: intro.value * m.a,
    transform: [
      { translateX: leanX.value * m.lean + drift.value.x },
      { translateY: leanY.value * m.lean * 0.6 + drift.value.y },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.mass,
        { left: W * m.kx - size / 2, top: H * m.ky - size / 2, width: size, height: size },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`m${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={m.hue} stopOpacity={0.9} />
            <Stop offset="0.5" stopColor={m.hue} stopOpacity={0.3} />
            <Stop offset="1" stopColor={m.hue} stopOpacity={0} />
          </RadialGradient>
          <Filter id={`f${i}`} x="-30%" y="-30%" width="160%" height="160%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation={size * 0.08} />
          </Filter>
        </Defs>
        <G filter={`url(#f${i})`}>
          <Circle cx={size / 2} cy={size / 2} r={size * 0.4} fill={`url(#m${i})`} />
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* the masses run wider than the screen on purpose, so the haze has no edge */
  clip: { overflow: 'hidden' },
  mass: { position: 'absolute' },
});
