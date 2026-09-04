/* ---------------------------------------------------------------------------
   Ember — one screen, two modes.

   Signing in and creating an account are the same surface. Switching drives a
   single 0..1 value, and everything that differs between the two reads off it:
   the heading crossfades, the name field opens to its measured height, the rule
   under the tabs slides. Nothing unmounts and nothing reloads, so the change is
   one continuous move rather than a page swap.

   Both modes keep their own route. Picking one rewrites the URL, and landing on
   either URL opens in that mode — but App holds a single instance of this
   component across both, which is what lets the change animate at all.
--------------------------------------------------------------------------- */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable,
  useWindowDimensions, type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withDelay, withTiming, withSpring,
  interpolate, Easing,
} from 'react-native-reanimated';

import Aurora, { useField } from './Aurora';
import Field from './Field';
import Ignite, { type Phase } from './Ignite';
import Switch from './Switch';
import { Google, Apple } from './glyphs';
import { c, hot, R, GUTTER, t, sans, sansTight } from './tokens';

export type Mode = 'login' | 'signup';

/* Less motion means the resting composition, no deal-in. It doubles as the
   preview escape hatch: a hidden pane pauses requestAnimationFrame, which
   freezes every entrance part-way. */
const reduceMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
export const STILL = reduceMotion;

const MORPH = { duration: 460, easing: Easing.bezier(0.32, 0.72, 0.2, 1) };
const CURVE = { duration: 560, easing: Easing.bezier(0.16, 1, 0.3, 1) };

function Rise({ at, children, style }: { at: number; children: React.ReactNode; style?: any }) {
  const v = useSharedValue(STILL ? 1 : 0);
  useEffect(() => {
    if (STILL) return;
    v.value = withDelay(90 + at * 60, withTiming(1, CURVE));
  }, [v, at]);
  const s = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: interpolate(v.value, [0, 1], [14, 0]) }],
  }));
  return <Animated.View style={[style, s]}>{children}</Animated.View>;
}

export default function AuthScreen({
  mode, onMode,
}: { mode: Mode; onMode: (m: Mode) => void }) {
  const field = useField();
  const { width: W, height: H } = useWindowDimensions();

  const intro = useSharedValue(STILL ? 1 : 0);
  useEffect(() => {
    if (STILL) return;
    intro.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
  }, [intro]);

  /* 0 signing in, 1 creating — the one value the whole morph reads from */
  const at = useSharedValue(mode === 'signup' ? 1 : 0);
  useEffect(() => {
    const to = mode === 'signup' ? 1 : 0;
    /* asked for less motion means arrive there, not travel there */
    at.value = STILL ? to : withTiming(to, MORPH);
  }, [mode, at]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [nameH, setNameH] = useState(0);
  const timers = useRef<any[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /* Nothing to submit to, so the control shows its own life cycle and returns
     to rest rather than pretending anyone was signed in. */
  const submit = useCallback(() => {
    if (phase !== 'idle') return;
    setPhase('busy');
    timers.current.push(setTimeout(() => setPhase('done'), 1200));
    timers.current.push(setTimeout(() => setPhase('idle'), 2600));
  }, [phase]);

  const track = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    field.x.value = Math.min(Math.max(locationX / W, 0), 1);
    field.y.value = Math.min(Math.max(locationY / H, 0), 1);
    field.on.value = 1;
  }, [field, W, H]);
  const lift = useCallback(() => { field.on.value = 0; }, [field]);

  /* the name field opens to the height it actually needs, measured once */
  const measureName = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setNameH((prev) => (prev ? prev : h));
  }, []);

  const nameSlot = useAnimatedStyle(() => ({
    height: nameH ? at.value * nameH : undefined,
    opacity: interpolate(at.value, [0, 0.45, 1], [0, 0, 1]),
  }));

  const signIn = useAnimatedStyle(() => ({
    opacity: interpolate(at.value, [0, 0.5], [1, 0]),
    transform: [{ translateY: interpolate(at.value, [0, 1], [0, -10]) }],
  }));
  const signUp = useAnimatedStyle(() => ({
    opacity: interpolate(at.value, [0.5, 1], [0, 1]),
    transform: [{ translateY: interpolate(at.value, [0, 1], [10, 0]) }],
  }));
  /* nothing to recover when you have not got an account yet */
  const recover = useAnimatedStyle(() => ({ opacity: 1 - at.value }));

  return (
    <View
      style={styles.root}
      onPointerMove={track}
      onPointerDown={track}
      onPointerUp={lift}
      onPointerLeave={lift}
      onPointerCancel={lift}
    >
      <Aurora field={field} intro={intro} />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Rise at={0}><Text style={styles.mark}>Ember</Text></Rise>

          <Rise at={1} style={styles.headBox}>
            <Animated.View style={[styles.head, signIn]}>
              <Text style={styles.display}>Welcome back</Text>
              <Text style={styles.lede}>Sign in to continue.</Text>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, signUp]}>
              <Text style={styles.display}>Create account</Text>
              <Text style={styles.lede}>Takes less than a minute.</Text>
            </Animated.View>
          </Rise>

          <Rise at={2}><Switch at={at} onPick={onMode} /></Rise>

          <Rise at={3}>
            {/* clipped to its animated height; the field inside never resizes */}
            <Animated.View style={[styles.slot, nameSlot]}>
              <View onLayout={measureName} style={nameH ? styles.abs : undefined}>
                <Field
                  label="Name" placeholder="" kind="name"
                  value={name} onChangeText={setName} autoComplete="name"
                />
              </View>
            </Animated.View>

            <Field
              label="Email" placeholder="you@company.com" kind="email"
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoComplete="email"
            />
            <Field
              label="Password" placeholder="" kind="password"
              value={password} onChangeText={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
            />
          </Rise>

          <Rise at={4} style={styles.cta}>
            <Ignite label="Continue" phase={phase} onPress={submit} />
          </Rise>

          <Rise at={5} style={styles.altRow}>
            <Provider brand="google" label="Google" />
            <Provider brand="apple" label="Apple" />
          </Rise>

          <Rise at={6} style={styles.foot}>
            <Animated.View style={recover}>
              <Pressable hitSlop={6} disabled={mode === 'signup'}>
                <Text style={styles.footLink}>Forgot your password?</Text>
              </Pressable>
            </Animated.View>
          </Rise>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Provider({ brand, label }: { brand: 'google' | 'apple'; label: string }) {
  const v = useSharedValue(0);
  const p = useSharedValue(0);
  const s = useAnimatedStyle(() => ({
    borderColor: `rgba(255,255,255,${0.09 + v.value * 0.11})`,
    backgroundColor: `rgba(255,255,255,${v.value * 0.03})`,
    transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.98]) }],
  }));
  const Mark = brand === 'google' ? Google : Apple;
  return (
    <Pressable
      style={styles.provWrap}
      onHoverIn={() => { v.value = withTiming(1, { duration: 190 }); }}
      onHoverOut={() => { v.value = withTiming(0, { duration: 230 }); }}
      onPressIn={() => { p.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { p.value = withSpring(0, { damping: 20, stiffness: 300 }); }}
    >
      <Animated.View style={[styles.prov, s]}>
        <Mark size={16} />
        <Text style={styles.provLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, overflow: 'hidden' },
  fill: { flex: 1 },
  page: {
    paddingHorizontal: GUTTER,
    paddingVertical: 48,
    minHeight: '100%',
    flexGrow: 1,
    justifyContent: 'center',
  },

  mark: {
    fontFamily: sansTight,
    fontSize: t.wordmark,
    fontWeight: '500',
    color: c.mute,
    letterSpacing: 0.4,
    marginBottom: 34,
  },

  headBox: { height: 68, marginBottom: 30 },
  head: {},
  display: {
    fontFamily: sansTight,
    fontSize: t.display,
    lineHeight: t.displayLine,
    fontWeight: '600',
    letterSpacing: t.displayTrack,
    color: c.text,
  },
  lede: {
    fontFamily: sans,
    fontSize: t.lede,
    lineHeight: t.ledeLine,
    color: c.body,
    marginTop: 7,
  },

  slot: { overflow: 'hidden' },
  abs: { position: 'absolute', left: 0, right: 0, top: 0 },

  cta: { marginTop: 10 },

  altRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  provWrap: { flex: 1 },
  prov: {
    height: 46,
    borderRadius: R.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  provLabel: { fontFamily: sans, fontSize: t.micro, fontWeight: '500', color: c.body },

  foot: { marginTop: 28, alignItems: 'center' },
  footLink: { fontFamily: sans, fontSize: t.micro, color: c.mute },
});
