import React from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withTiming,
  SharedValue, interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import { colors, mono, u } from '../theme';

/* Floating control pill.

   Measured off a settled frame of the capture, flattened to 430x932:
     pill      x 21 -> 412  (391 wide), y 837 -> 909 (72 tall), radius ~15
     burger    x 37 -> 61,  two 2-thick rules 5 apart
     EXPLORE   x 76 -> 112
     brackets  x ~147 and ~387, two 2.5 dots at y 863 / 882
     track     x 151 -> 385 (234 long), 1.5 thick, on the centre line y 873
     handle    ~2 wide, 27 tall, riding the track
     58 X      x 347 -> 365 — and notably it sits at y ~893, BELOW the centre
               line rather than on it, tucked into the lower right.
   Bottom inset is 23, so the pill clears the phone edge. */
const PILL_W = 391;
const PILL_H = 72;
const RADIUS = 15;

function Bracket() {
  return (
    <View style={styles.bracket}>
      <View style={styles.dot} />
      <View style={styles.dot} />
    </View>
  );
}

export default function ExploreBar({
  progress,
  label = 'EXPLORE',
  readout = '58 X',
  floating = false,
}: {
  progress: SharedValue<number>;
  label?: string;
  readout?: string;
  floating?: boolean;
}) {
  const trackW = u(234);

  const handle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [0, trackW], Extrapolation.CLAMP) },
    ],
  }));

  /* scaled rather than resized, so the fill costs no layout */
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0.0001, Math.min(1, progress.value)) }],
  }));

  /* Settles in just after the launch begins rather than waiting for the rest
     of it: at a 900ms delay the bar was the last thing on screen to arrive,
     which is most of why the opening felt slow. Still not on frame one. */
  const enter = useSharedValue(0);
  React.useEffect(() => {
    const run = (reduced: boolean) => {
      if (reduced) { enter.value = 1; return; }
      enter.value = withDelay(250, withTiming(1, {
        duration: 520, easing: Easing.bezier(0.22, 1, 0.36, 1),
      }));
    };
    run(false);
    try {
      const probe = AccessibilityInfo.isReduceMotionEnabled?.();
      if (probe && typeof probe.then === 'function') {
        probe.then((r) => { if (r) run(true); }).catch(() => {});
      }
    } catch { /* keep the motion */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [u(10), 0]) },
      { scale: interpolate(enter.value, [0, 1], [0.98, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.pill, floating && styles.floating, settle]}>
      {/* the main row runs on the pill's centre line */}
      <View style={styles.row}>
        <View style={styles.burger}>
          <View style={styles.burgerLine} />
          <View style={styles.burgerLine} />
        </View>

        <Text style={styles.label}>{label}</Text>

        <View style={styles.sliderWrap}>
          <Bracket />
          <View style={[styles.rail, { width: trackW }]}>
            {/* the run behind the handle is the bold one; the rest is a ghost */}
            <Animated.View style={[styles.fill, { width: trackW }, fill]} />
            <Animated.View style={[styles.handle, handle]} />
          </View>
          <Bracket />
        </View>
      </View>

      {/* the value hangs below the centre line, tucked right */}
      <Text style={styles.readout}>{readout}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: u(PILL_W),
    height: u(PILL_H),
    alignSelf: 'center',
    justifyContent: 'center',
  },
  floating: {
    backgroundColor: colors.white,
    borderRadius: u(RADIUS),
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: u(12),
    shadowOffset: { width: 0, height: u(4) },
    elevation: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: u(16),
    paddingRight: u(5),
  },
  burger: { width: u(24), gap: u(3) },
  burgerLine: { height: u(2), backgroundColor: colors.ink },
  label: {
    fontFamily: mono,
    fontSize: u(9),
    letterSpacing: u(1.1),
    color: colors.ink,
    marginLeft: u(15),
  },
  sliderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: u(33),
    gap: u(4),
  },
  /* Measured across the track on a settled frame: left of the handle the
     line reads lum 120 over about 2 units, right of it only 242 — nearly
     nothing. It is a filled run plus a ghost rail, not one flat grey. */
  rail: {
    height: u(1.2),
    backgroundColor: 'rgba(18,17,15,0.08)',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: u(2),
    backgroundColor: 'rgba(18,17,15,0.57)',
    transformOrigin: 'left center',
  },
  handle: {
    position: 'absolute',
    left: u(-1),
    width: u(2.4),
    height: u(27),
    backgroundColor: colors.ink,
  },
  /* the dots measure ~6 across in the capture, centres 19 apart */
  bracket: { height: u(25), justifyContent: 'space-between' },
  dot: { width: u(5.5), height: u(5.5), backgroundColor: colors.ink },
  readout: {
    position: 'absolute',
    right: u(26),
    bottom: u(13),
    fontFamily: mono,
    fontSize: u(8),
    letterSpacing: u(1),
    color: colors.muted,
  },
});
