import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withRepeat, withTiming, withDelay,
  interpolate, Extrapolation, SharedValue, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import DotMatrixText from '../components/DotMatrixText';
import ScanReveal from '../components/ScanReveal';
import TypeOut from '../components/TypeOut';
import { FieldRecord } from '../data';
import { colors, mono, u, SCREEN } from '../theme';

export default function DetailScreen({
  record, chrome, onClose,
}: {
  record: FieldRecord;
  chrome: SharedValue<number>;
  onClose: () => void;
}) {
  /* Each readout runs on its own clock rather than off slices of one linear
     value — a window on a linear clock moves linearly, which is what made
     these read mechanically. Delays are the ones measured off the capture
     (pick at 6.40): caption up by ~8.0, heading from ~8.2, number from ~9.2,
     so 1.5s / 1.8s / 2.8s after the tap. Mount happens on the tap, so a delay
     from mount is a delay from the pick.

     Everything is transform + opacity only, so nothing here triggers layout. */
  const EASE = Easing.bezier(0.22, 1, 0.36, 1);

  const capT = useSharedValue(0);
  const headT = useSharedValue(0);
  const teleT = useSharedValue(0);
  const numT = useSharedValue(0);

  React.useEffect(() => {
    let alive = true;
    const run = (reduced: boolean) => {
      if (!alive) return;
      if (reduced) {
        /* no travel, no scale — just present */
        capT.value = 1; headT.value = 1; teleT.value = 1; numT.value = 1;
        return;
      }
      capT.value  = withDelay(1500, withTiming(1, { duration: 700,  easing: EASE }));
      headT.value = withDelay(1800, withTiming(1, { duration: 1000, easing: EASE }));
      teleT.value = withDelay(2300, withTiming(1, { duration: 800,  easing: EASE }));
      numT.value  = withDelay(2600, withTiming(1, { duration: 1400, easing: EASE }));
    };

    /* The probe must never be able to swallow the sequence: if it is missing,
       throws, or simply never settles, the animation still runs. Only a
       positive answer suppresses it. */
    run(false);
    try {
      const probe = AccessibilityInfo.isReduceMotionEnabled?.();
      if (probe && typeof probe.then === 'function') {
        probe.then((reduced) => { if (reduced) run(true); }).catch(() => {});
      }
    } catch {
      /* platform does not expose it — keep the motion */
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* chrome only gates the whole block, so closing the card fades it out */
  const captionIn = useAnimatedStyle(() => ({
    opacity: capT.value * chrome.value,
    transform: [{ translateY: interpolate(capT.value, [0, 1], [u(10), 0]) }],
  }));

  /* heading: opacity + a 0.94 -> 1 scale + a slight offset along the axis the
     capture travels on, settling with no overshoot */
  const azimuthIn = useAnimatedStyle(() => ({
    opacity: interpolate(headT.value, [0, 0.6], [0, 1], Extrapolation.CLAMP) * chrome.value,
    transform: [
      { translateY: interpolate(headT.value, [0, 1], [u(12), 0]) },
      { scale: interpolate(headT.value, [0, 1], [0.98, 1]) },
    ],
  }));

  /* the number is a reveal rather than a move: it grows from 0.86 into place.
     The + rides the same transform as the digits, so it cannot lag behind. */
  /* The capture pins the glyph's TOP edge at y 657 while its bottom grows
     659 -> 710, i.e. it is uncovered downward rather than faded. So the digits
     ride down inside a window clipped to their own height: start fully above
     it, travel their full 58 units, arrive sharp. */
  const readoutIn = useAnimatedStyle(() => ({
    opacity: interpolate(numT.value, [0, 0.15], [0, 1], Extrapolation.CLAMP) * chrome.value,
    transform: [{ translateY: interpolate(numT.value, [0, 1], [-u(58), 0]) }],
  }));

  const late = useAnimatedStyle(() => ({ opacity: teleT.value * chrome.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* one shot per selection — the key restarts it when the record changes */}
        <ScanReveal key={record.id} />

        {/* a soft scrim so the heading holds up over a dark biome */}
        <View style={styles.topScrim} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
          </Svg>
        </View>

        <Animated.View style={[styles.azimuth, azimuthIn]}>
          <TypeOut text={record.azimuth} style={styles.azimuthText} speed={55} delay={1850} />
        </Animated.View>


        <Animated.View style={[styles.telemetry, late]}>
          {record.telemetry.map((line) => (
            <Text key={line} style={styles.telemetryText}>{line}</Text>
          ))}
        </Animated.View>

        <View style={styles.readoutClip} pointerEvents="none">
          <Animated.View style={readoutIn}>
            <DotMatrixText text={record.readout} cell={u(5.5)} gap={u(7.5)} color={colors.white} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.captionBlock, captionIn]}>
          {record.caption.map((line) => (
            <Text key={line} style={styles.caption}>{line}</Text>
          ))}
        </Animated.View>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Measured off the flattened capture: cap height 23 units, lines 32.6
     apart, block starting at x 42 with its first cap top at y 70, and
     "CALCULATE" running 42 -> 234 (21.3 per character). That puts the face
     near 33 with about 1.4 of tracking — nearly twice what I had. */
  /* 212 wide, not 268: the capture breaks after 9 characters — CALCULATE /
     D_AZIMU / TH: 345 — and 'CALCULATE' itself measures 192 units, so the
     column has to be just under ten characters to wrap the same way. */
  azimuth: { position: 'absolute', left: u(42), top: u(64), width: u(212), pointerEvents: 'none', transformOrigin: 'left top' },
  azimuthText: {
    fontFamily: mono,
    fontSize: u(33),
    lineHeight: u(33),
    letterSpacing: u(1.4),
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  telemetry: { position: 'absolute', right: u(52), top: u(360) },
  telemetryText: {
    fontFamily: mono,
    fontSize: u(6.5),
    lineHeight: u(9),
    letterSpacing: u(0.8),
    color: 'rgba(255,255,255,0.85)',
  },
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: u(230) },
  /* the digits measure 52 tall and ~40 wide, i.e. a 7.5 lattice on the 5x7
     grid, sitting at x 21 with its top on y 657 */
  /* the window is exactly the glyph's own height (5x7 lattice at 7.5), so
     it hides the digits completely before they drop in */
  readoutClip: { position: 'absolute', left: u(21), bottom: u(222), height: u(53), overflow: 'hidden' },
  captionBlock: { position: 'absolute', left: u(20), bottom: u(151) },
  caption: {
    fontFamily: mono,
    fontSize: u(11),
    lineHeight: u(15),
    letterSpacing: u(0.9),
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});
