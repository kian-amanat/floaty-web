/* ---------------------------------------------------------------------------
   Ember — one screen, two modes.

   Signing in and creating an account are the same surface. Switching drives a
   single 0..1 value and everything that differs reads off it: the heading
   crossfades, the two extra fields open to the height they actually need, the
   rule under the tabs slides. Nothing unmounts and nothing reloads.

   Both modes keep their own route. Picking one rewrites the URL, and landing on
   either opens in that mode — but App holds a single instance across both,
   which is what lets the change animate rather than reload.

   The arrival is a queue, not a fade: each row has a place in line and waits
   its turn. `Rise` takes that place as `at`, so re-ordering the form re-orders
   the entrance with it and nothing has to be re-timed by hand.
--------------------------------------------------------------------------- */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import ShinyCTA, { type Phase } from './ShinyCTA';
import Switch from './Switch';
import { Google, Apple } from './glyphs';
import { validate, isClean, type Errors, type Values } from './validate';
import StrengthMeter from './StrengthMeter';
import { strengthOf } from './passwordStrength';
import { installWebStyles } from './webStyles';
import { c, R, GUTTER, t, sans, sansTight } from './tokens';

export type Mode = 'login' | 'signup';

installWebStyles();

/* Less motion means the resting composition, no deal-in. It doubles as the
   preview escape hatch: a hidden pane pauses requestAnimationFrame, which
   freezes every entrance part-way. */
const reduceMotion =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
export const STILL = reduceMotion;

const MORPH = { duration: 460, easing: Easing.bezier(0.32, 0.72, 0.2, 1) };

/* What a labelled field and the strength meter come to, before either has been
   measured. Only ever stand-ins: the real height replaces them a frame later. */
const FIELD_SLOT = 100;
const METER_SLOT = 146;

/* One row of the arrival.

   Paced so each row is unmistakably its own beat: the gap between rows is
   longer than it needs to be, and each row travels far enough to be read as
   arriving rather than merely appearing. Opacity leads the movement slightly —
   a row is already faintly there before it finishes settling, which is what
   stops a long stagger feeling like a series of pop-ins. */
const LEAD = 260;      // the light comes up before anything moves
const STEP = 115;      // between one row and the next
const RUN = 760;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const LIFT = 26;

/* A row that is closed is still mounted — it has to be, to be measured and to
   animate — but it should not be reachable while it is shut. */
function closed(open: boolean) {
  return open
    ? {}
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
        'aria-hidden': true,
        pointerEvents: 'none' as const,
      };
}

function Rise({ at, children, style }: { at: number; children: React.ReactNode; style?: any }) {
  const v = useSharedValue(STILL ? 1 : 0);
  useEffect(() => {
    if (STILL) return;
    v.value = withDelay(LEAD + at * STEP, withTiming(1, { duration: RUN, easing: EASE_OUT }));
  }, [v, at]);
  const s = useAnimatedStyle(() => ({
    /* opacity runs ahead of the travel, so nothing snaps into place */
    opacity: interpolate(v.value, [0, 0.55, 1], [0, 0.9, 1]),
    transform: [
      { translateY: interpolate(v.value, [0, 1], [LIFT, 0]) },
      { scale: interpolate(v.value, [0, 1], [0.982, 1]) },
    ],
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
    intro.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
  }, [intro]);

  /* 0 signing in, 1 creating — the one value the whole morph reads from */
  const at = useSharedValue(mode === 'signup' ? 1 : 0);
  useEffect(() => {
    const to = mode === 'signup' ? 1 : 0;
    at.value = STILL ? to : withTiming(to, MORPH);
  }, [mode, at]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [tried, setTried] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [extraH, setExtraH] = useState({ name: 0, confirm: 0, meter: 0 });
  const timers = useRef<any[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const values: Values = useMemo(
    () => ({ name, email, password, confirm }), [name, email, password, confirm],
  );
  const strength = useMemo(() => strengthOf(password), [password]);
  const isUp = mode === 'signup';

  /* Checked on submit, then live — so nobody is told their address is wrong
     while they are still halfway through typing it, but a correction clears
     the moment it is made. */
  useEffect(() => {
    if (!tried) return;
    setErrors(validate(mode, values));
  }, [tried, mode, values]);

  /* switching modes retires anything the other mode was complaining about */
  useEffect(() => { setErrors({}); setTried(false); }, [mode]);

  const submit = useCallback(() => {
    if (phase !== 'idle') return;
    const found = validate(mode, values);
    setTried(true);
    setErrors(found);
    if (!isClean(found)) return;

    /* Nothing to submit to, so the control shows its own life cycle and
       returns to rest rather than pretending anyone was signed in. */
    setPhase('busy');
    timers.current.push(setTimeout(() => setPhase('done'), 1200));
    timers.current.push(setTimeout(() => setPhase('idle'), 2600));
  }, [phase, mode, values]);

  const track = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    field.x.value = Math.min(Math.max(locationX / W, 0), 1);
    field.y.value = Math.min(Math.max(locationY / H, 0), 1);
    field.on.value = 1;
  }, [field, W, H]);
  const lift = useCallback(() => { field.on.value = 0; }, [field]);

  /* the sign-up-only fields open to the height they actually need, measured
     once each rather than guessed at */
  const measure = useCallback((key: 'name' | 'confirm' | 'meter') => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setExtraH((prev) => (prev[key] === h ? prev : { ...prev, [key]: h }));
  }, []);

  /* The field inside is always taken out of flow, so it reports its height on
     mount whichever mode we opened in, and the slot's own height is only ever
     `at` times that.

     Until that measurement lands the slot falls back to the height the design
     says it should be. onLayout is scheduled off a frame, so a slot that waits
     for it is collapsed on the first paint and pops open afterwards — and if
     frames are not running at all, it never opens. The fallback is close enough
     that the correction is not visible when it arrives. */
  const nameSlot = useAnimatedStyle(() => ({
    height: at.value * (extraH.name || FIELD_SLOT),
    opacity: interpolate(at.value, [0, 0.5, 1], [0, 0, 1]),
  }));
  const confirmSlot = useAnimatedStyle(() => ({
    height: at.value * (extraH.confirm || FIELD_SLOT),
    opacity: interpolate(at.value, [0, 0.5, 1], [0, 0, 1]),
  }));
  /* The meter belongs to the password field for exactly as long as the field is
     being used. Moving to the next input closes it again — the rules were help
     while writing, not a verdict to leave standing. If the password still does
     not pass, the field's own error says so on submit. */
  const meterOpen = useSharedValue(0);
  useEffect(() => {
    const open = mode === 'signup' && pwFocused;
    meterOpen.value = STILL
      ? (open ? 1 : 0)
      : withTiming(open ? 1 : 0, { duration: 320, easing: Easing.bezier(0.2, 0.9, 0.3, 1) });
  }, [mode, pwFocused, meterOpen]);

  const meterSlot = useAnimatedStyle(() => ({
    height: at.value * meterOpen.value * (extraH.meter || METER_SLOT),
    opacity: at.value * interpolate(meterOpen.value, [0, 0.45, 1], [0, 0, 1]),
  }));

  const signIn = useAnimatedStyle(() => ({
    opacity: interpolate(at.value, [0, 0.5], [1, 0]),
    transform: [{ translateY: interpolate(at.value, [0, 1], [0, -10]) }],
  }));
  const signUp = useAnimatedStyle(() => ({
    opacity: interpolate(at.value, [0.5, 1], [0, 1]),
    transform: [{ translateY: interpolate(at.value, [0, 1], [10, 0]) }],
  }));
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
          <Rise at={0} style={styles.headBox}>
            <Animated.View style={signIn}>
              <Text style={styles.display}>Welcome back</Text>
              <Text style={styles.lede}>Sign in to continue.</Text>
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, signUp]}>
              <Text style={styles.display}>Create account</Text>
              <Text style={styles.lede}>Takes less than a minute.</Text>
            </Animated.View>
          </Rise>

          <Rise at={1}><Switch at={at} onPick={onMode} /></Rise>

          <Rise at={2}>
            <Animated.View style={[styles.slot, nameSlot]} {...closed(isUp)}>
              <View onLayout={measure('name')} style={styles.abs}>
                <Field
                  label="Name" placeholder="Ada Lovelace" kind="name"
                  value={name} onChangeText={setName} autoComplete="name"
                  error={errors.name} returnKeyType="next"
                />
              </View>
            </Animated.View>
          </Rise>

          <Rise at={3}>
            <Field
              label="Email" placeholder="you@company.com" kind="email"
              value={email} onChangeText={setEmail}
              keyboardType="email-address" autoComplete="email"
              error={errors.email} returnKeyType="next"
            />
          </Rise>

          <Rise at={4}>
            <Field
              label="Password"
              placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              kind="password"
              value={password} onChangeText={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'password'}
              error={errors.password}
              returnKeyType={mode === 'signup' ? 'next' : 'go'}
              onSubmitEditing={mode === 'signup' ? undefined : submit}
              onFocusChange={setPwFocused}
            />

            {/* Measured out of flow like the other mode-only rows, so the slot
                has its height on the first paint instead of popping open. */}
            <Animated.View style={[styles.slot, meterSlot]} {...closed(isUp && pwFocused)}>
              <View onLayout={measure('meter')} style={styles.abs}>
                <StrengthMeter strength={strength} />
              </View>
            </Animated.View>
          </Rise>

          <Rise at={5}>
            <Animated.View style={[styles.slot, confirmSlot]} {...closed(isUp)}>
              <View onLayout={measure('confirm')} style={styles.abs}>
                <Field
                  label="Repeat password" placeholder="Type it once more" kind="password"
                  value={confirm} onChangeText={setConfirm} autoComplete="new-password"
                  error={errors.confirm} returnKeyType="go"
                  onSubmitEditing={submit}
                />
              </View>
            </Animated.View>
          </Rise>

          <Rise at={6} style={styles.cta}>
            <ShinyCTA label="Continue" phase={phase} onPress={submit} />
          </Rise>

          <Rise at={7} style={styles.altRow}>
            <Provider brand="google" label="Google" />
            <Provider brand="apple" label="Apple" />
          </Rise>

          <Rise at={8} style={styles.foot}>
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
    paddingTop: 58,
    paddingBottom: 34,
    minHeight: '100%',
  },

  headBox: { height: 70, marginBottom: 26 },
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
    marginTop: 6,
  },

  slot: { overflow: 'hidden' },
  abs: { position: 'absolute', left: 0, right: 0, top: 0 },

  cta: { marginTop: 12 },

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

  foot: { marginTop: 'auto', paddingTop: 26, alignItems: 'center' },
  footLink: { fontFamily: sans, fontSize: t.micro, color: c.mute },
});
