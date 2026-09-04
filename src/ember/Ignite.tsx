/* ---------------------------------------------------------------------------
   The primary action.

   The fill is a gradient half again the button's width. At rest only its deep
   end shows; hovering slides it so the light end travels across. Moving the
   gradient rather than cross-fading two of them is what makes the light look
   like it crosses the surface instead of the surface changing colour.

   Pressing settles it slightly into the page. Submitting keeps the shape and
   turns the label over to a spinner and then a tick, so the control reads as
   one thing doing three jobs.

   Its width is never animated. Driving layout from a measured value means the
   first paint happens before the measurement lands, and the button pops from
   text-width to full-width a frame later.
--------------------------------------------------------------------------- */

import React, { useCallback, useState } from 'react';
import {
  Text, View, StyleSheet, Pressable, type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat,
  interpolate, Easing,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';

import { c, hot, BTN_H, R, t, sans } from './tokens';
import { Tick } from './glyphs';

export type Phase = 'idle' | 'busy' | 'done';

const SPRING = { damping: 20, stiffness: 260, mass: 0.7 };
const GLIDE = { duration: 620, easing: Easing.bezier(0.22, 0.8, 0.24, 1) };

export default function Ignite({
  label, phase = 'idle', onPress,
}: { label: string; phase?: Phase; onPress?: () => void }) {
  const [w, setW] = useState(0);
  const over = useSharedValue(0);
  const press = useSharedValue(0);
  const busy = useSharedValue(0);
  const done = useSharedValue(0);
  const spin = useSharedValue(0);

  /* react-native-svg on web falls back to 300x150 for a style-only size, which
     leaves the fill short of the button's edge — so the width is measured. */
  const measure = useCallback((e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width), []);

  React.useEffect(() => {
    busy.value = withTiming(phase === 'idle' ? 0 : 1, { duration: 380, easing: Easing.bezier(0.6, 0, 0.2, 1) });
    done.value = withTiming(phase === 'done' ? 1 : 0, { duration: 260 });
    if (phase === 'busy') {
      spin.value = 0;
      spin.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.linear }), -1, false);
    }
  }, [phase, busy, done, spin]);

  const enter = useCallback(() => { over.value = withTiming(1, GLIDE); }, [over]);
  const leave = useCallback(() => {
    over.value = withTiming(0, GLIDE);
    press.value = withSpring(0, SPRING);
  }, [over, press]);

  const shell = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.985]) }],
  }));

  /* the gradient itself travels; the button does not change colour */
  const wash = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(over.value, [0, 1], [0, -w * 0.42]) }],
    opacity: 1 - busy.value * 0.1,
  }));

  const lift = useAnimatedStyle(() => ({
    opacity: interpolate(over.value, [0, 1], [0.22, 0.5]) * (1 - done.value * 0.5),
    transform: [{ scale: interpolate(press.value, [0, 1], [1, 0.97]) }],
  }));

  const cap = useAnimatedStyle(() => ({
    opacity: 1 - busy.value,
    transform: [{ scale: interpolate(busy.value, [0, 1], [1, 0.92]) }],
  }));

  const ring = useAnimatedStyle(() => ({
    opacity: busy.value * (1 - done.value),
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  const tick = useAnimatedStyle(() => ({
    opacity: done.value,
    transform: [{ scale: interpolate(done.value, [0, 1], [0.5, 1]) }],
  }));

  return (
    <View style={styles.wrap} onLayout={measure}>
      <Animated.View style={[styles.lift, lift]} pointerEvents="none" />

      <Animated.View style={[styles.shell, shell]}>
        <Pressable
          style={styles.hit}
          onHoverIn={enter}
          onHoverOut={leave}
          onPressIn={() => { press.value = withSpring(1, SPRING); enter(); }}
          onPressOut={leave}
          onPress={onPress}
        >
          {w > 0 && (
            <Animated.View style={[StyleSheet.absoluteFill, wash]} pointerEvents="none">
              <Svg width={w * 1.42} height={BTN_H}>
                <Defs>
                  <LinearGradient id="ig" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={c.hotDeep} />
                    <Stop offset="0.42" stopColor={c.hot} />
                    <Stop offset="0.72" stopColor={c.hotSoft} />
                    <Stop offset="1" stopColor={c.hot} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width={w * 1.42} height={BTN_H} fill="url(#ig)" />
              </Svg>
            </Animated.View>
          )}

          <Animated.Text style={[styles.label, cap]}>{label}</Animated.Text>

          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, ring]} pointerEvents="none">
            <Svg width={22} height={22} viewBox="0 0 26 26">
              <Circle cx="13" cy="13" r="9.5" stroke="rgba(255,255,255,0.28)" strokeWidth={2.6} fill="none" />
              <Circle cx="13" cy="13" r="9.5" stroke="#fff" strokeWidth={2.6} fill="none"
                strokeLinecap="round" strokeDasharray="15 45" />
            </Svg>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, tick]} pointerEvents="none">
            <Tick size={19} tint="#fff" />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: BTN_H, justifyContent: 'center' },
  lift: {
    position: 'absolute',
    left: 10, right: 10, top: 5, bottom: 1,
    borderRadius: R.btn,
    backgroundColor: hot(0.5),
  },
  shell: {
    height: BTN_H,
    borderRadius: R.btn,
    overflow: 'hidden',
    backgroundColor: c.hot,
  },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: sans,
    fontSize: t.button,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.1,
  },
});
