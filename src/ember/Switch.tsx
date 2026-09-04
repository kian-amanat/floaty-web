/* Two words and a rule that slides between them. A filled segmented control at
   this size was the loudest thing on the screen and said very little. */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle, interpolate, interpolateColor,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { c, t, sans } from './tokens';

export default function Switch({
  at, onPick,
}: { at: SharedValue<number>; onPick: (m: 'login' | 'signup') => void }) {
  const [w, setW] = React.useState(0);
  const half = w ? w / 2 : 0;

  const rule = useAnimatedStyle(() => ({
    width: half * 0.52,
    transform: [{
      translateX: interpolate(at.value, [0, 1], [half * 0.24, half + half * 0.24]),
    }],
  }));

  return (
    <View style={styles.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={styles.row}>
        <Tab label="Sign in" at={at} want={0} onPress={() => onPick('login')} />
        <Tab label="Create account" at={at} want={1} onPress={() => onPick('signup')} />
      </View>
      <View style={styles.track}>
        {half > 0 && <Animated.View style={[styles.rule, rule]} />}
      </View>
    </View>
  );
}

function Tab({ label, at, want, onPress }: {
  label: string; at: SharedValue<number>; want: 0 | 1; onPress: () => void;
}) {
  const s = useAnimatedStyle(() => {
    const near = 1 - Math.min(Math.abs(at.value - want), 1);
    return { color: interpolateColor(near, [0, 1], [c.mute, c.text]) };
  });
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Animated.Text style={[styles.label, s]}>{label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 26 },
  row: { flexDirection: 'row' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  label: { fontFamily: sans, fontSize: t.micro + 0.5, fontWeight: '500' },
  track: { height: 1, backgroundColor: c.hair },
  rule: { position: 'absolute', top: 0, height: 1, backgroundColor: c.hot },
});
