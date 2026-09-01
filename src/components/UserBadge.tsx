import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation, Easing,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, mono, u } from '../theme';

/* Top-right tab. Every number below is measured off the capture in 430x932
   reference units, and the whole thing is driven by one clock so the beats
   land where they do in the video:

     0.30  a black hairline draws in, full width, 2 tall
     1.05  it has thickened into a pill and the name fades up inside it
     1.35  the pill is squaring off into a disc ...
     1.28  ... while a second small disc appears on the paper BELOW it,
           detached, and swells on its own
     1.45  the slab lunges up and down and swallows the lower disc
     1.70  the avatar resolves in the top of the slab
     2.40  settled

   The slab's top and bottom edges are keyed separately — it does not grow
   about its centre. It reaches upward first, then drops to take the disc. */
/* Re-measured on the perspective-corrected frame rather than the tight
   flatten I used first: the panel runs x 343 -> 415, so 72 wide with a 15
   right margin — not 78 at 10. The avatar is 49 across (I had 58), its
   widest row sits on y 62, and HI, JACK lands on y 105-110, roughly a
   dozen units above where I had it. The white disc measures 53. */
const W = 72;

const KEYS   = [0.30, 1.05, 1.25, 1.35, 1.45, 1.55, 1.70, 2.10, 2.40];
const TOPS   = [ 112,  103,   89,   87,   52,   37,   35,   22,   20];
const BOTS   = [ 114,  124,  125,  134,  145,  168,  200,  206,  206];

const AVATAR = 49;
const AVATAR_Y = 62;    // centre — the avatar's widest row in the capture
const BTN = 53;
const BTN_Y = 169;      // centre, absolute in the slot
const SLOT_H = 215;

export default function UserBadge({ name = 'JACK', at }: { name?: string; at?: number }) {
  const T = useSharedValue(at ?? 0);   // seconds along the intro

  useEffect(() => {
    if (at !== undefined) { T.value = at; return; }   // pinned for inspection
    T.value = withTiming(2.6, { duration: 2600, easing: Easing.linear });
  }, [T, at]);

  const slab = useAnimatedStyle(() => {
    const top = interpolate(T.value, KEYS, TOPS, Extrapolation.CLAMP);
    const bottom = interpolate(T.value, KEYS, BOTS, Extrapolation.CLAMP);
    const height = Math.max(0, u(bottom - top));
    return {
      top: u(top),
      height,
      borderRadius: Math.min(u(W), height) / 2,
      opacity: T.value >= 0.3 ? 1 : 0,
    };
  });

  /* the name rides just below the slab's middle, drifting the few units it
     drifts in the capture as the slab opens out */
  const label = useAnimatedStyle(() => ({
    opacity: interpolate(T.value, [0.95, 1.25], [0, 1], Extrapolation.CLAMP),
    top: u(interpolate(T.value, [1.05, 2.10], [98, 102], Extrapolation.CLAMP)),
  }));

  const avatar = useAnimatedStyle(() => {
    const t = interpolate(T.value, [1.48, 1.85], [0, 1], Extrapolation.CLAMP);
    return { opacity: t, transform: [{ scale: 0.6 + 0.4 * t }] };
  });

  /* the lower disc is on stage from 1.28, well before the slab reaches down
     for it, so it spends a moment sitting on bare paper */
  const button = useAnimatedStyle(() => {
    const d = interpolate(T.value, [1.28, 1.45, 1.90], [0, 18, BTN], Extrapolation.CLAMP);
    return {
      width: u(d),
      height: u(d),
      borderRadius: u(d) / 2,
      top: u(BTN_Y) - u(d) / 2,
      left: u(W) / 2 - u(d) / 2,
      // the rim would otherwise still occupy a few pixels at zero size
      borderWidth: d > 0.5 ? u(1.5) : 0,
      opacity: d > 0.5 ? 1 : 0,
    };
  });

  const glyph = useAnimatedStyle(() => ({
    opacity: interpolate(T.value, [1.55, 1.90], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.slot} pointerEvents="box-none">
      <Animated.View style={[styles.slab, slab]} />

      <Animated.View style={[styles.avatar, avatar]}>
        <Image source={require('../../assets/ui/avatar-jack.jpg')} style={styles.avatarImg} />
      </Animated.View>

      <Animated.Text style={[styles.hi, label]} numberOfLines={1}>
        HI, {name}
      </Animated.Text>

      <Animated.View style={[styles.btn, button]}>
        <View style={styles.btnCore}>
          <Animated.View style={glyph}>
            <Svg width={u(13)} height={u(13)} viewBox="0 0 24 24">
              <Path d="M13.6 2 L5 13.2 h5.3 l-1.7 8.8 L19 10.6 h-5.3 z" fill={colors.white} />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    position: 'absolute',
    right: u(15),
    top: 0,
    width: u(W),
    height: u(SLOT_H),
    zIndex: 20,
  },
  slab: {
    position: 'absolute',
    left: 0,
    width: u(W),
    backgroundColor: colors.panel,
  },
  avatar: {
    position: 'absolute',
    top: u(AVATAR_Y - AVATAR / 2),
    left: u(W / 2 - AVATAR / 2),
    width: u(AVATAR),
    height: u(AVATAR),
    borderRadius: u(AVATAR) / 2,
    borderWidth: u(4),
    borderColor: '#BDBBB8',
    overflow: 'hidden',
    backgroundColor: colors.panel,
  },
  avatarImg: { width: '100%', height: '100%' },
  hi: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    color: colors.white,
    fontFamily: mono,
    fontSize: u(8),
    lineHeight: u(11),
    letterSpacing: u(0.7),
  },
  /* white disc with a dark rim, so it still reads while it is out on the
     paper and again once the slab has closed round it */
  btn: {
    position: 'absolute',
    backgroundColor: colors.white,
    borderColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  btnCore: {
    width: '46%',
    height: '46%',
    borderRadius: 999,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
