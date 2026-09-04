/* ---------------------------------------------------------------------------
   The password strength meter.

   A port of the shadcn `password-input-2` readout to React Native: the five
   segments, the caption, and the requirement list. The original is DOM and
   Tailwind — div/input/className and lucide-react — none of which exist here,
   so the markup is rebuilt while the rules and scoring are kept verbatim in
   ./passwordStrength.

   Which glyph a rule shows and whether a segment is lit both come straight from
   the props; the springs only add the flourish on top. Deriving the state from
   an animated value instead would mean a rule that is met still reads as unmet
   until a frame runs, which is wrong every time the list is rendered without
   one — a cheap way to be quietly incorrect.
--------------------------------------------------------------------------- */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate,
  interpolateColor,
} from 'react-native-reanimated';

import { c, t, sans } from './tokens';
import { CAPTIONS, TONES, type Strength } from './passwordStrength';
import { Tick, Cross } from './glyphs';

const SPRING = { damping: 18, stiffness: 190 };

export default function StrengthMeter({ strength }: { strength: Strength }) {
  const { score, requirements } = strength;

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Segment key={n} lit={score >= n} tone={TONES[score]} />
        ))}
      </View>

      <View style={styles.captionRow}>
        <Text style={styles.must}>Must contain</Text>
        <Caption score={score} />
      </View>

      <View style={styles.list}>
        {requirements.map((r) => <Rule key={r.text} met={r.met} text={r.text} />)}
      </View>
    </View>
  );
}

function Segment({ lit, tone }: { lit: boolean; tone: string }) {
  const v = useSharedValue(lit ? 1 : 0);
  React.useEffect(() => { v.value = withSpring(lit ? 1 : 0, SPRING); }, [lit, v]);

  /* the fill grows out from the left; whether it is there at all is the prop */
  const fill = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(v.value, [0, 1], [0.15, 1]) }],
  }));

  return (
    <View style={styles.seg}>
      {lit && (
        <Animated.View style={[styles.segFill, { backgroundColor: tone }, fill]} />
      )}
    </View>
  );
}

function Caption({ score }: { score: number }) {
  const v = useSharedValue(score);
  React.useEffect(() => { v.value = withTiming(score, { duration: 220 }); }, [score, v]);
  const s = useAnimatedStyle(() => ({
    color: interpolateColor(
      v.value, [0, 1, 3, 5],
      [c.mute, TONES[1], TONES[3], TONES[5]],
    ),
  }));
  return <Animated.Text style={[styles.caption, s]}>{CAPTIONS[score as 0]}</Animated.Text>;
}

function Rule({ met, text }: { met: boolean; text: string }) {
  /* restarted whenever the rule flips, so the new glyph pops in */
  const pop = useSharedValue(1);
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    pop.value = 0;
    pop.value = withSpring(1, SPRING);
  }, [met, pop]);

  const mark = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.45, 1]) }],
  }));

  return (
    <View style={styles.rule}>
      <Animated.View style={[styles.mark, styles.centre, mark]}>
        {met ? <Tick size={13} tint={TONES[5]} /> : <Cross size={13} tint={c.ghost} />}
      </Animated.View>
      <Text style={[styles.ruleText, { color: met ? TONES[5] : c.mute }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Sits right under the password field it reads: the segments are a readout
     of that input, so the gap above them is tighter than the gap to whatever
     comes next. The field's own error no longer reserves room when it is not
     showing, so this is the whole of the space above. */
  wrap: { paddingTop: 0, paddingBottom: 26 },
  bars: { flexDirection: 'row', gap: 6 },
  seg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
  },
  segFill: { flex: 1, borderRadius: 2 },

  captionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 9,
  },
  must: { fontFamily: sans, fontSize: 12, color: c.mute },
  caption: { fontFamily: sans, fontSize: 12, fontWeight: '600' },

  list: { marginTop: 7, gap: 5 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 13, height: 13 },
  centre: { alignItems: 'center', justifyContent: 'center' },
  ruleText: { fontFamily: sans, fontSize: 12, lineHeight: 15 },
});
