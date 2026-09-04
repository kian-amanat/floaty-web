/* ---------------------------------------------------------------------------
   The shiny call to action.

   A port of the CSS original, which leans on things React Native does not
   have — @property, conic-gradient, ::before/::after, mask-image. The look is
   rebuilt from the parts that do exist:

   * the lit border is a ring mask with a beam rotating behind it. A linear
     gradient swept around the centre reads the same as the conic one, because
     what you actually see is the ring sampling it at each angle.
   * the dot field is an SVG pattern under the same rotating mask, so the dots
     only catch the light where the beam is passing.
   * the shimmer is a slanted highlight travelling across the face on its own
     loop, deliberately out of step with the border so the two never sync up.

   Hover widens and brightens the beam rather than starting anything, so there
   is nothing to wait for when the pointer arrives.

   A press fires a one-shot wash across the whole face: two bands rather than
   one, a broad body running the full warm range from deep ember through amber
   to a near-white core, and a narrower, hotter crest that leads it by a fifth
   of the pass. Two bands at different speeds is what gives the light depth —
   a single band, however wide, only ever reads as a stripe.

   It crosses fast — the snap is the point; the colour is what makes it worth
   watching. The dots brighten under it as it goes, and the label inverts for
   the moment the crest is over it. It is fired rather than held, so a second press restarts it and the
   button always answers, even mid-sweep.
--------------------------------------------------------------------------- */

import React, { useCallback, useState } from 'react';
import {
  Text, View, StyleSheet, Pressable, type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, useDerivedValue,
  withSpring, withTiming, withRepeat, interpolate, interpolateColor, Easing,
} from 'react-native-reanimated';
import Svg, {
  Defs, LinearGradient, Stop, Rect, G, Mask, Pattern, Circle,
} from 'react-native-svg';

import { c, R, BTN_H, t, sans } from './tokens';
import { Tick } from './glyphs';

export type Phase = 'idle' | 'busy' | 'done';

const AnimatedG = Animated.createAnimatedComponent(G);
const SPIN_MS = 3000;      // one turn of the border beam
const SHIMMER_MS = 3400;   // deliberately not a multiple of the above
const RING = 1.8;
/* the body is wide enough to light most of the face at once; the crest is a
   third of it, so the two never read as one band */
const BODY_K = 0.78;
const CREST_K = 0.26;

export default function ShinyCTA({
  label, phase = 'idle', onPress, disabled,
}: {
  label: string;
  phase?: Phase;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const [w, setW] = useState(0);
  /* react-native-svg on web falls back to 300x150 for a style-only size, so
     every Svg here is given the measured width outright. */
  const measure = useCallback((e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width), []);

  /* the centre the beam turns about, needed before the animated props below */
  const cx = w / 2;
  const cy = BTN_H / 2;

  const spin = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const over = useSharedValue(0);
  const press = useSharedValue(0);
  const busy = useSharedValue(0);
  const done = useSharedValue(0);
  const work = useSharedValue(0);
  const wash = useSharedValue(1);   // 0..1, one pass across the face

  React.useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
    shimmer.value = withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: Easing.linear }), -1, false);
  }, [spin, shimmer]);

  React.useEffect(() => {
    busy.value = withTiming(phase === 'idle' ? 0 : 1, { duration: 300 });
    done.value = withTiming(phase === 'done' ? 1 : 0, { duration: 260 });
    if (phase === 'busy') {
      work.value = 0;
      work.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.linear }), -1, false);
    }
  }, [phase, busy, done, work]);

  /* restarted from zero on every press, so it always reads as a response */
  const fire = useCallback(() => {
    wash.value = 0;
    wash.value = withTiming(1, { duration: 780, easing: Easing.bezier(0.3, 0, 0.2, 1) });
  }, [wash]);

  const enter = useCallback(() => {
    if (disabled) return;
    over.value = withTiming(1, { duration: 700, easing: Easing.bezier(0.25, 1, 0.5, 1) });
  }, [over, disabled]);
  const leave = useCallback(() => {
    over.value = withTiming(0, { duration: 700, easing: Easing.bezier(0.25, 1, 0.5, 1) });
    press.value = withSpring(0, { damping: 22, stiffness: 320 });
  }, [over, press]);

  /* the beam turns; the ring mask is what makes it read as a lit edge */
  const beam = useAnimatedProps(() => ({
    transform: `rotate(${spin.value * 360} ${cx} ${cy})`,
  }));

  const shell = useAnimatedStyle(() => ({
    opacity: disabled ? 0.45 : 1,
    transform: [{ translateY: press.value * 1.5 }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    const kick = interpolate(wash.value, [0, 0.25, 0.6, 1], [0, 0.45, 0.3, 0]);
    return {
      opacity: (interpolate(over.value, [0, 1], [0.3, 0.6]) + kick) * (1 - done.value * 0.4),
    };
  });

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(over.value, [0, 1], [0.06, 0.16]) * (1 - busy.value),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-(w || 0) * 1.1, (w || 0) * 1.1]) }],
  }));

  /* The label dips dark only while the bright core is actually over it — a
     short window, and to a warm brown rather than a neutral one, so the
     in-between frames read as amber instead of grey. */
  const cap = useAnimatedStyle(() => ({
    opacity: 1 - busy.value,
    color: interpolateColor(
      wash.value,
      [0.47, 0.56, 0.65],
      [c.text, '#3A1E0A', c.text],
    ),
  }));

  /* the wash crosses the whole button, not just its edge */
  const span = (w || 0) * 1.25;
  const washStyle = useAnimatedStyle(() => ({
    opacity: interpolate(wash.value, [0, 0.1, 0.72, 1], [0, 0.95, 0.7, 0]) * (1 - busy.value),
    transform: [{ translateX: interpolate(wash.value, [0, 1], [-span, span]) }],
  }));
  /* the crest leads the body, so the light has an edge and a wake */
  const crestStyle = useAnimatedStyle(() => {
    const lead = Math.min(wash.value * 1.22, 1);
    return {
      opacity: interpolate(lead, [0, 0.08, 0.65, 1], [0, 1, 0.6, 0]) * (1 - busy.value),
      transform: [{ translateX: interpolate(lead, [0, 1], [-span, span]) }],
    };
  });
  /* the dot field catches the light as the wash goes over it */
  const dotsStyle = useAnimatedStyle(() => ({
    opacity: 0.75 + interpolate(wash.value, [0, 0.35, 1], [0, 0.85, 0]),
  }));
  const ring = useAnimatedStyle(() => ({
    opacity: busy.value * (1 - done.value),
    transform: [{ rotate: `${work.value * 360}deg` }],
  }));
  const tick = useAnimatedStyle(() => ({
    opacity: done.value,
    transform: [{ scale: interpolate(done.value, [0, 1], [0.5, 1]) }],
  }));

  /* the beam brightens and widens under the pointer instead of speeding up —
     a faster spin reads as impatience, a wider one as heat */
  const stops = useDerivedValue(() => ({
    spread: interpolate(over.value, [0, 1], [0.1, 0.26]),
    peak: interpolate(over.value, [0, 1], [0.85, 1]),
  }));

  const D = Math.max(w, BTN_H) * 1.6;
  const BODY = Math.max(w * BODY_K, 150);
  const CREST = Math.max(w * CREST_K, 60);

  return (
    <View style={styles.wrap} onLayout={measure}>
      <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />

      <Animated.View style={[styles.shell, shell]}>
        <Pressable
          style={styles.hit}
          onHoverIn={enter}
          onHoverOut={leave}
          onPressIn={() => {
            if (disabled) return;
            press.value = withSpring(1, { damping: 22, stiffness: 320 });
            enter();
            fire();
          }}
          onPressOut={leave}
          onPress={disabled ? undefined : onPress}
        >
          {w > 0 && (
            <>
              {/* the dot field, only lit where the beam passes */}
              <Animated.View style={[StyleSheet.absoluteFill, dotsStyle]} pointerEvents="none">
                <Svg width={w} height={BTN_H}>
                  <Defs>
                    <Pattern id="dots" width={4} height={4} patternUnits="userSpaceOnUse">
                      <Circle cx={1} cy={1} r={0.5} fill="#ffffff" />
                    </Pattern>
                    <Mask id="dotmask">
                      <AnimatedG animatedProps={beam}>
                        <Rect
                          x={w / 2 - D / 2} y={BTN_H / 2 - D / 2} width={D} height={D}
                          fill="url(#sweep)"
                        />
                      </AnimatedG>
                    </Mask>
                    <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#000" />
                      <Stop offset="0.4" stopColor="#fff" />
                      <Stop offset="0.6" stopColor="#fff" />
                      <Stop offset="1" stopColor="#000" />
                    </LinearGradient>
                  </Defs>
                  <Rect
                    x="0" y="0" width={w} height={BTN_H} rx={BTN_H / 2}
                    fill="url(#dots)" opacity={0.28} mask="url(#dotmask)"
                  />
                </Svg>
              </Animated.View>

              {/* the lit border */}
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg width={w} height={BTN_H}>
                  <Defs>
                    <LinearGradient id="beamfill" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor={c.hot} stopOpacity={0} />
                      <Stop offset="0.28" stopColor={c.hotSoft} stopOpacity={1} />
                      <Stop offset="0.5" stopColor="#FFE7D2" stopOpacity={1} />
                      <Stop offset="0.72" stopColor={c.hotSoft} stopOpacity={1} />
                      <Stop offset="1" stopColor={c.hot} stopOpacity={0} />
                    </LinearGradient>
                    <Mask id="ringmask">
                      <Rect x="0" y="0" width={w} height={BTN_H} fill="black" />
                      <Rect
                        x={RING / 2} y={RING / 2}
                        width={w - RING} height={BTN_H - RING}
                        rx={(BTN_H - RING) / 2}
                        fill="none" stroke="white" strokeWidth={RING}
                      />
                    </Mask>
                  </Defs>
                  {/* the edge always has a base tone, so it never goes dark */}
                  <Rect
                    x={RING / 2} y={RING / 2} width={w - RING} height={BTN_H - RING}
                    rx={(BTN_H - RING) / 2}
                    fill="none" stroke="rgba(232,98,31,0.55)" strokeWidth={RING}
                  />
                  <G mask="url(#ringmask)">
                    <AnimatedG animatedProps={beam}>
                      <Rect
                        x={w / 2 - D / 2} y={BTN_H / 2 - D / 2} width={D} height={D}
                        fill="url(#beamfill)"
                      />
                    </AnimatedG>
                  </G>
                </Svg>
              </View>

              {/* the press wash: the broad body of the light */}
              <View style={styles.clip} pointerEvents="none">
                <Animated.View style={washStyle}>
                  <Svg width={BODY} height={BTN_H}>
                    <Defs>
                      <LinearGradient id="wash" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={c.hotDeep} stopOpacity={0} />
                        <Stop offset="0.16" stopColor={c.hotDeep} stopOpacity={0.5} />
                        <Stop offset="0.32" stopColor={c.hot} stopOpacity={0.8} />
                        <Stop offset="0.46" stopColor="#FFA046" stopOpacity={0.92} />
                        <Stop offset="0.56" stopColor="#FFD79A" stopOpacity={1} />
                        <Stop offset="0.66" stopColor="#FFF3E2" stopOpacity={1} />
                        <Stop offset="0.78" stopColor="#FFB65C" stopOpacity={0.8} />
                        <Stop offset="0.9" stopColor={c.hot} stopOpacity={0.4} />
                        <Stop offset="1" stopColor={c.hotDeep} stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width={BODY} height={BTN_H} fill="url(#wash)" />
                  </Svg>
                </Animated.View>
              </View>

              {/* and the crest that runs ahead of it */}
              <View style={styles.clip} pointerEvents="none">
                <Animated.View style={crestStyle}>
                  <Svg width={CREST} height={BTN_H}>
                    <Defs>
                      <LinearGradient id="crest" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#FFF6EA" stopOpacity={0} />
                        <Stop offset="0.5" stopColor="#FFFCF6" stopOpacity={0.95} />
                        <Stop offset="1" stopColor="#FFC98A" stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width={CREST} height={BTN_H} fill="url(#crest)" />
                  </Svg>
                </Animated.View>
              </View>

              {/* the shimmer crossing the face */}
              <View style={styles.clip} pointerEvents="none">
                <Animated.View style={shimmerStyle}>
                  <Svg width={Math.max(w * 0.5, 90)} height={BTN_H * 2}>
                    <Defs>
                      <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                        <Stop offset="0.5" stopColor="#FFCFA8" stopOpacity={1} />
                        <Stop offset="1" stopColor="#fff" stopOpacity={0} />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x="0" y={-BTN_H / 2} width={Math.max(w * 0.5, 90)} height={BTN_H * 2}
                      fill="url(#shine)" transform={`skewX(-18)`}
                    />
                  </Svg>
                </Animated.View>
              </View>
            </>
          )}

          <Animated.Text style={[styles.label, cap]}>{label}</Animated.Text>

          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, ring]} pointerEvents="none">
            <Svg width={20} height={20} viewBox="0 0 26 26">
              <Circle cx="13" cy="13" r="9.5" stroke="rgba(255,255,255,0.22)" strokeWidth={2.6} fill="none" />
              <Circle cx="13" cy="13" r="9.5" stroke={c.hotSoft} strokeWidth={2.6} fill="none"
                strokeLinecap="round" strokeDasharray="15 45" />
            </Svg>
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, styles.centre, tick]} pointerEvents="none">
            <Tick size={18} tint={c.hotSoft} />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: BTN_H, justifyContent: 'center' },
  glow: {
    position: 'absolute',
    left: 10, right: 10, top: 5, bottom: 1,
    borderRadius: BTN_H / 2,
    backgroundColor: c.hot,
  },
  shell: {
    height: BTN_H,
    borderRadius: BTN_H / 2,
    overflow: 'hidden',
    backgroundColor: '#141013',
    /* the resting edge is a real border, so the button is already itself on the
       first frame — the SVG ring only overlays it once the width is measured,
       and onLayout does not land until a frame later */
    borderWidth: 1,
    borderColor: 'rgba(232,98,31,0.5)',
  },
  clip: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: sans,
    fontSize: t.button,
    fontWeight: '500',
    color: c.text,
    letterSpacing: 0.2,
  },
});
