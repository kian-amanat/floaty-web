import React from 'react';
import { View, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withTiming, withSequence,
  interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { SCREEN, u } from '../theme';

/* The analysing scan that runs once over a newly selected background.

   Measured on the reference by counting pixels with G-(R+B)/2 > 25 inside the
   screen, on a 3x4 grid:

       t=12.40   0.1  14.3  26.8      <- row 2 only; rows 0,1,3 are ~0
       t=13.20   1.2  30.8  25.7
       t=14.00  21.3  66.2  43.7
       t=14.80  36.9  89.4  81.8

   Three things fall out of that. It is confined to a single horizontal band
   around 50-75% of the height — not a full-frame wash and not a vertical
   sweep. It starts on the RIGHT of that band and travels LEFT: the centroid
   runs x 256 -> 243 -> 224. And it grows as it goes, coverage climbing
   3.2% -> 17.3% while the mean lift goes +1.5 -> +9.4.

   Onset is late and sudden: flat from 9.0 to 12.4, then away from ~12.8.

   Everything animates on transform and opacity, and the layer unmounts
   itself clean — the band is gone at the end, no tint left behind. */
const BAND_Y = 0.62;      // centre of the band, as a fraction of the height
const BAND_H = 0.30;      // its height
const CORE = '#6FBF74';   // sampled off the capture's strongest pixels

export default function ScanReveal() {
  const t = useSharedValue(0);   // 0 -> 1 travel/growth
  const fade = useSharedValue(0);

  React.useEffect(() => {
    const run = (reduced: boolean) => {
      if (reduced) return;               // no scan at all, no residue
      t.value = withTiming(1, { duration: 1900, easing: Easing.out(Easing.cubic) });
      fade.value = withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
        withDelay(900, withTiming(0, { duration: 760, easing: Easing.inOut(Easing.quad) }))
      );
    };
    run(false);
    try {
      const probe = AccessibilityInfo.isReduceMotionEnabled?.();
      if (probe && typeof probe.then === 'function') {
        probe.then((r) => { if (r) { t.value = 0; fade.value = 0; } }).catch(() => {});
      }
    } catch { /* keep the scan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* the field enters from the right of the band and opens leftward as it
     widens — translate carries the travel, scale carries the growth */
  const core = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: interpolate(t.value, [0, 1], [SCREEN.w * 0.34, -SCREEN.w * 0.1], Extrapolation.CLAMP) },
      { scaleX: interpolate(t.value, [0, 1], [0.45, 1.5], Extrapolation.CLAMP) },
      { scaleY: interpolate(t.value, [0, 1], [0.7, 1.15], Extrapolation.CLAMP) },
    ],
  }));

  /* a broader, fainter halo trailing the core so the edges dissolve */
  const halo = useAnimatedStyle(() => ({
    opacity: fade.value * 0.55,
    transform: [
      { translateX: interpolate(t.value, [0, 1], [SCREEN.w * 0.4, -SCREEN.w * 0.2], Extrapolation.CLAMP) },
      { scaleX: interpolate(t.value, [0, 1], [0.7, 2.1], Extrapolation.CLAMP) },
      { scaleY: interpolate(t.value, [0, 1], [1.0, 1.6], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={styles.clip} pointerEvents="none">
      <Animated.View style={[styles.band, halo]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={CORE} stopOpacity="0.30" />
              <Stop offset="0.55" stopColor={CORE} stopOpacity="0.14" />
              <Stop offset="1" stopColor={CORE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#halo)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.band, core]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="core" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0" stopColor={CORE} stopOpacity="0.62" />
              <Stop offset="0.4" stopColor={CORE} stopOpacity="0.34" />
              <Stop offset="0.75" stopColor={CORE} stopOpacity="0.1" />
              <Stop offset="1" stopColor={CORE} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#core)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* clipped to the image area so nothing leaks past the phone */
  clip: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  band: {
    position: 'absolute',
    left: -u(60),
    right: -u(60),
    top: SCREEN.h * (BAND_Y - BAND_H / 2),
    height: SCREEN.h * BAND_H,
  },
});
