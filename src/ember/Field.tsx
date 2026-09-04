/* ---------------------------------------------------------------------------
   A field.

   One 0..1 focus value moves the hairline, the wash and the glyph together, so
   focus and blur are the same animation run in reverse and an interruption
   part-way just changes where it is heading.

   The browser draws its own focus ring on the underlying input — a blue box
   that has nothing to do with this design — so it is suppressed here and the
   hairline is the only focus affordance.
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

export type Kind = 'email' | 'password' | 'name';
const GLYPH = { email: Mail, password: Lock, name: User };

export default function Field({
  label, placeholder, kind, value, onChangeText, keyboardType, autoComplete,
}: {
  label: string;
  placeholder: string;
  kind: Kind;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: 'email' | 'password' | 'new-password' | 'name';
}) {
  const [hidden, setHidden] = useState(kind === 'password');
  const focus = useSharedValue(0);
  const shown = useSharedValue(0);
  const Glyph = GLYPH[kind];

  const onFocus = useCallback(() => { focus.value = withTiming(1, EASE); }, [focus]);
  const onBlur = useCallback(() => { focus.value = withTiming(0, EASE); }, [focus]);
  const toggle = useCallback(() => {
    setHidden((h) => {
      shown.value = withSpring(h ? 1 : 0, { damping: 17, stiffness: 220 });
      return !h;
    });
  }, [shown]);

  const box = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.value, [0, 1], [c.pane, c.paneLift]),
    borderColor: interpolateColor(focus.value, [0, 1], [c.hair, hot(0.62)]),
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
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: 14 },
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
});
