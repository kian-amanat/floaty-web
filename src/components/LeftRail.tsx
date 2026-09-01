import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle, interpolate, Extrapolation, SharedValue,
} from 'react-native-reanimated';
import DotMatrixText from './DotMatrixText';
import PixelMark from './PixelMark';
import { colors, mono, u } from '../theme';

/* Date, mark, clock and assignment label.

   This sits ABOVE the growing photo, not under it. In the capture the photo
   is already most of the way open at 6.80 and fullscreen by 7.10, and the
   left-hand type is still drawn over the top of it in both frames — MONDAY
   and 9:PM are legible against the biome. They are only cleared afterwards,
   walking off to the right one at a time. Rendering this inside the home
   screen put it under the hero, so the growth wiped it out early. */
export default function LeftRail({
  intro, railGo,
}: {
  intro: SharedValue<number>;
  railGo: SharedValue<number>;
}) {
  const enter = (from: number, to: number, rise = 10) =>
    useAnimatedStyle(() => {
      const t = interpolate(intro.value, [from, to], [0, 1], Extrapolation.CLAMP);
      return { opacity: t, transform: [{ translateY: interpolate(t, [0, 1], [rise, 0]) }] };
    });

  /* They leave to the LEFT, not the right — at 7.40 the clock reads ":PM"
     with the 9 already clipped off the near edge. The mark goes first and
     covers its ground fastest, then the assignment label, the clock, and the
     date last, the whole handover spread over 2s so it drifts rather than
     snaps. */
  const leave = (from: number, to: number) =>
    useAnimatedStyle(() => {
      const t = interpolate(railGo.value, [from, to], [0, 1], Extrapolation.CLAMP);
      return {
        transform: [{ translateX: interpolate(t, [0, 1], [0, -u(190)]) }],
        opacity: 1 - t,
      };
    });

  const dateIn = enter(0.02, 0.32);
  /* The mark takes NO intro at all — it is complete in the capture's first
     frame, so it must be complete in ours. No fade, no rise, no scale; it
     inherits nothing from the page reveal. It still leaves with the rail. */
  const markIn = useAnimatedStyle(() => ({}));
  const clockIn = enter(0.16, 0.46);
  const assignIn = enter(0.24, 0.54);

  const markOut = leave(0, 0.26);
  const assignOut = leave(0.16, 0.56);
  const clockOut = leave(0.32, 0.78);
  const dateOut = leave(0.48, 1);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.dateBlock, dateIn, dateOut]}>
        <Text style={styles.meta}>MONDAY</Text>
        <Text style={styles.meta}>01</Text>
        <Text style={styles.meta}>MAY</Text>
      </Animated.View>

      <Animated.View style={[styles.mark, markIn, markOut]}>
        <PixelMark size={u(46)} />
      </Animated.View>

      <Animated.View style={[styles.clock, clockIn, clockOut]}>
        <DotMatrixText text="9:PM" cell={u(3.4)} gap={u(4.5)} />
      </Animated.View>

      <Animated.View style={[styles.assignment, assignIn, assignOut]}>
        <Text style={styles.meta}>PROJECT</Text>
        <Text style={styles.meta}>ASSIGNM</Text>
        <Text style={styles.meta}>ENT</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  meta: {
    fontFamily: mono,
    fontSize: u(9),
    lineHeight: u(15),
    letterSpacing: u(1.3),
    color: colors.ink,
  },
  dateBlock: { position: 'absolute', left: u(26), top: u(88) },
  mark: { position: 'absolute', left: u(42), top: u(288) },
  clock: { position: 'absolute', left: u(20), top: u(452) },
  assignment: { position: 'absolute', left: u(30), top: u(612) },
});
