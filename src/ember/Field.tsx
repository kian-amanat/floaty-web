/* ---------------------------------------------------------------------------
   A field.

   One 0..1 focus value moves the hairline, the wash and the glyph together, so
   focus and blur are the same animation run in reverse and an interruption
   part-way just changes where it is heading.

   The browser draws its own focus ring on the underlying input — a blue box
   that has nothing to do with this design — so it is suppressed here and the
   hairline is the only focus affordance.

   An error takes the hairline over from focus and states the problem under the
   field. It is announced on submit rather than while typing, so the form does
   not argue with someone half way through their address.

   The message opens its own room rather than sitting in a slot kept empty for
   it: a reserved gap under every field is dead space on a form that is usually
   valid, and under the password field on the sign-up form it pushes the
   requirement list away from the input it belongs to. Height and opacity run
   off the same 0..1, so the space arrives and leaves with the words.
--------------------------------------------------------------------------- */

import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable, Platform,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate,
  interpolateColor, Easing,
} from 'react-native-reanimated';

import { c, hot, R, FIELD_H, t, sans } from './tokens';
import { Mail, Lock, User, Eye, Slash } from './glyphs';

const EASE = { duration: 260, easing: Easing.bezier(0.22, 0.9, 0.3, 1) };

/* the message, the gap above it, and the gap below */
const NOTE_H = 19;
const NOTE_GAP_TOP = 9;

export type Kind = 'email' | 'password' | 'name';
const GLYPH = { email: Mail, password: Lock, name: User };

export default function Field({
  label, placeholder, kind, value, onChangeText, keyboardType, autoComplete,
  error, onSubmitEditing, returnKeyType, onFocusChange,
}: {
  label: string;
  placeholder: string;
  kind: Kind;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
  error?: string;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'done' | 'go';
  /* so a caller can reveal something alongside the field while it is being
     filled in — the strength meter opens on the password field this way */
  onFocusChange?: (focused: boolean) => void;
}) {
  const [hidden, setHidden] = useState(kind === 'password');
  const focus = useSharedValue(0);
  const shown = useSharedValue(0);
  const Glyph = GLYPH[kind];

  const onFocus = useCallback(() => {
    focus.value = withTiming(1, EASE);
    onFocusChange?.(true);
  }, [focus, onFocusChange]);
  const onBlur = useCallback(() => {
    focus.value = withTiming(0, EASE);
    onFocusChange?.(false);
  }, [focus, onFocusChange]);
  const toggle = useCallback(() => {
    setHidden((h) => {
      shown.value = withSpring(h ? 1 : 0, { damping: 17, stiffness: 220 });
      return !h;
    });
  }, [shown]);

  /* an error outranks focus: the hairline stays red while it stands */
  const bad = useSharedValue(0);
  React.useEffect(() => {
    bad.value = withTiming(error ? 1 : 0, EASE);
  }, [error, bad]);

  /* The words outlive the error by one animation. Rendering them straight off
     `error` unmounts them on the instant it clears, which cuts the fade-out
     before a frame of it has run — the message appears smoothly and then
     vanishes. Holding the last one keeps something there to fade. */
  const [message, setMessage] = useState(error);
  React.useEffect(() => {
    if (error) { setMessage(error); return; }
    /* dropped once it has finished leaving, so a message that is no longer true
       is not left sitting in the tree for a screen reader to find */
    const id = setTimeout(() => setMessage(undefined), EASE.duration);
    return () => clearTimeout(id);
  }, [error]);

  const box = useAnimatedStyle(() => {
    const base = interpolateColor(focus.value, [0, 1], [c.hair, hot(0.62)]);
    return {
      backgroundColor: interpolateColor(focus.value, [0, 1], [c.pane, c.paneLift]),
      borderColor: interpolateColor(bad.value, [0, 1], [base as string, c.bad]),
    };
  });

  const note = useAnimatedStyle(() => ({
    opacity: bad.value,
    transform: [{ translateY: interpolate(bad.value, [0, 1], [-3, 0]) }],
  }));

  /* the room the message needs, opened and closed with it */
  const slot = useAnimatedStyle(() => ({
    height: bad.value * (NOTE_H + NOTE_GAP_TOP),
    opacity: bad.value,
  }));

  const cap = useAnimatedStyle(() => ({
    color: interpolateColor(focus.value, [0, 1], [c.mute, c.body]),
  }));

  const glyph = useAnimatedStyle(() => ({ opacity: interpolate(focus.value, [0, 1], [0.4, 0.85]) }));

  const slash = useAnimatedStyle(() => ({
    opacity: 1 - shown.value,
    transform: [{ scale: interpolate(shown.value, [0, 1], [1, 0.6]) }],
  }));

  return (
    <View style={styles.group}>
      <Animated.Text style={[styles.cap, cap]}>{label}</Animated.Text>

      <Animated.View style={[styles.box, box]}>
        <Animated.View style={glyph}><Glyph size={17} tint={c.body} /></Animated.View>

        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={c.ghost}
          secureTextEntry={hidden}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          selectionColor={c.hot}
          underlineColorAndroid="transparent"
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
        />

        {kind === 'password' && (
          <Pressable onPress={toggle} hitSlop={12}>
            <View style={styles.eye}>
              <Eye size={18} tint={c.mute} />
              <Animated.View style={[StyleSheet.absoluteFill, slash]}>
                <Slash size={18} tint={c.mute} />
              </Animated.View>
            </View>
          </Pressable>
        )}
      </Animated.View>

      <Animated.View style={[styles.noteSlot, slot]}>
        {!!message && <Animated.Text style={[styles.note, note]}>{message}</Animated.Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 10 },
  cap: {
    fontFamily: sans,
    fontSize: t.label,
    fontWeight: '400',
    marginBottom: 7,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: FIELD_H,
    borderRadius: R.field,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 11,
  },
  input: {
    flex: 1,
    color: c.text,
    fontFamily: sans,
    fontSize: t.field,
    padding: 0,
    height: '100%',
    /* the browser's own focus ring is a blue box that belongs to no design
       here; the hairline is the affordance */
    ...Platform.select({
      web: { outlineStyle: 'none', outlineWidth: 0, borderWidth: 0 } as any,
      default: {},
    }),
  },
  eye: { width: 18, height: 18 },
  noteSlot: { overflow: 'hidden', justifyContent: 'flex-end' },
  note: { fontFamily: sans, fontSize: 12, lineHeight: NOTE_H, color: c.bad },
});
