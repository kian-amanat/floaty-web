import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue, withTiming, withDelay, withSequence,
  interpolate, Extrapolation, Easing, runOnJS,
} from 'react-native-reanimated';

import HomeScreen from './src/screens/HomeScreen';
import DetailScreen from './src/screens/DetailScreen';
import LeftRail from './src/components/LeftRail';
import ExploreBar from './src/components/ExploreBar';
import UserBadge from './src/components/UserBadge';
import RightRail from './src/components/RightRail';
import { RECORDS } from './src/data';
import {
  colors, u, SCREEN, FOCUS_W, FOCUS_H, FOCUS_R, SLOT, COLUMN_X, FOCUS_Y,
} from './src/theme';

/* Timed off the capture by counting the photo's pixels frame by frame and
   taking sqrt(area) as linear progress: it leaves the card at 6.40, is 33%
   open by 0.24s, 65% by 0.40s, 92% by 0.56s and lands at 7.36 — a ~950ms
   move, not the 620ms I had. The shape is a gentle S, easing in off the card
   and settling long, so the old bezier(0.22, 1, ...) — which is almost
   instant off the line — was the wrong curve as well as the wrong length. */
const OPEN = { duration: 950, easing: Easing.bezier(0.25, 0.1, 0.25, 1) };
const SHUT = { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) };

export default function App() {
  const scrollY = useSharedValue(0);
  const focusIndex = useSharedValue(0);
  const expand = useSharedValue(0);   // 0 home .. 1 detail
  const chrome = useSharedValue(0);   // detail text + rail
  const intro = useSharedValue(0);    // launch reveal of the left rail + badge
  const [open, setOpen] = useState<number | null>(null);
  const [barFloating, setBarFloating] = useState(false);

  /* the column deals itself out on launch — one shared value per card, so the
     hook count stays fixed regardless of how the list is edited */
  const c0 = useSharedValue(0);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const c3 = useSharedValue(0);
  const c4 = useSharedValue(0);
  const deal = useMemo(() => [c0, c1, c2, c3, c4], [c0, c1, c2, c3, c4]);

  /* Which card is squared off, as a continuous index. The capture runs a
     deliberate scan rather than reacting to scroll: it opens on card 3, walks
     up to 1, then back down through to 5, then climbs to 4 and settles on 3 —
     the middle of the column. Anchored on the peaks I could measure: card 2 at
     3.35s, card 5 at 4.25, card 4 at 4.85, card 3 from 5.45 on. */
  const scan = useSharedValue(2);

  useEffect(() => {
    intro.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    /* Sampling the 4 -> 3 handover at 0.1s shows the morph is an ease-OUT, not
       a symmetric one: card 3 is 33% square 0.1s in, 72% by 0.3s, then a long
       tail to 100% around 1.0s. Cubic-out over the step duration tracks that
       within a few percent. The two cards' squareness also sums to 1 the whole
       way across (0.33+0.65, 0.57+0.43, 0.72+0.28), so the shape is handed
       over rather than duplicated — which the linear falloff already gives.
       Steps are quick through the down-sweep and slow into the final rest. */
    const step = Easing.inOut(Easing.cubic);   // no velocity jump between steps
    const rest = Easing.out(Easing.cubic);     // the measured settle onto card 3
    scan.value = withDelay(2000, withSequence(
      withTiming(2, { duration: 260, easing: step }),   // card 3  — opens here
      withTiming(1, { duration: 400, easing: step }),   // card 2
      withTiming(0, { duration: 400, easing: step }),   // card 1
      withTiming(1, { duration: 400, easing: step }),   // card 2   (peak 3.35)
      withTiming(2, { duration: 300, easing: step }),   // card 3
      withTiming(3, { duration: 300, easing: step }),   // card 4
      withTiming(4, { duration: 400, easing: step }),   // card 5   (peak 4.25)
      withTiming(3, { duration: 500, easing: step }),   // card 4   (peak 4.85)
      withTiming(2, { duration: 1000, easing: rest })   // card 3   — settles ~5.9
    ));
    deal.forEach((v, i) => {
      /* measured off the capture: first card leaves the bottom edge at t=0
         and each next one follows 390ms later, taking ~1.3s to coast into
         its slot on a long ease-out */
      v.value = withDelay(
        i * 390,
        withTiming(1, { duration: 1300, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      );
    });
  }, [deal, intro]);

  /* The handle is not parked at zero while the column deals in — the capture
     has it already 19% along at t=1.0 and creeping to 52% by t=3.0, where it
     sits once everything has landed (track 140..366, handle 182 -> 258). So
     the launch sweep owns it first and scroll takes over from there. */
  const progress = useDerivedValue(() => {
    const max = u(SLOT) * (RECORDS.length - 1);
    const scroll = max > 0 ? Math.min(Math.max(scrollY.value / max, 0), 1) : 0;
    const settled = 0.19 + 0.33 * intro.value;
    return Math.min(1, settled + scroll * (1 - 0.52));
  });

  const focusY = SCREEN.h * FOCUS_Y;
  const fromLeft = u(COLUMN_X) - u(FOCUS_W) / 2;
  /* the photo grows out of the card that is actually squared, so the origin
     follows the opened index down the column rather than sitting on a line */
  const padTop = focusY - u(SLOT) / 2;
  const [fromTop, setFromTop] = useState(focusY - u(FOCUS_H) / 2);

  /* the rail does not leave with the photo — it holds through the whole grow
     and only then walks off, the mark first and quickest */
  const railGo = useSharedValue(0);

  const openCard = useCallback((i: number) => {
    setFromTop(padTop + i * u(SLOT) + u(SLOT) / 2 - scrollY.value - u(FOCUS_H) / 2);
    setOpen(i);
    setBarFloating(true);
    expand.value = withTiming(1, OPEN);
    /* Read off the capture, with the pick starting at 6.40: the mark is gone
       by 7.10, the clock and date by 7.70, the foot caption fades up around
       8.30, the heading slides in 8.30 -> 9.50 and the number drops in last
       near 9.20. So the reveal runs about 3.4s end to end, not 420ms — one
       linear clock, and each piece takes its own window out of it. */
    railGo.value = withDelay(600, withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.cubic) }));
    chrome.value = withTiming(1, { duration: 4600, easing: Easing.linear });
  }, [expand, chrome, railGo, padTop, scrollY]);

  const closeCard = useCallback(() => {
    chrome.value = withTiming(0, { duration: 200 });
    railGo.value = withTiming(0, { duration: 260 });
    expand.value = withTiming(0, SHUT, (done) => {
      if (done) runOnJS(setOpen)(null);
    });
    setBarFloating(false);
  }, [expand, chrome, railGo]);

  /* the tapped card becomes the detail backdrop */
  const heroStyle = useAnimatedStyle(() => ({
    left: interpolate(expand.value, [0, 1], [fromLeft, 0], Extrapolation.CLAMP),
    top: interpolate(expand.value, [0, 1], [fromTop, 0], Extrapolation.CLAMP),
    width: interpolate(expand.value, [0, 1], [u(FOCUS_W), SCREEN.w], Extrapolation.CLAMP),
    height: interpolate(expand.value, [0, 1], [u(FOCUS_H), SCREEN.h], Extrapolation.CLAMP),
    borderRadius: interpolate(expand.value, [0, 1], [u(FOCUS_R), 0], Extrapolation.CLAMP),
    opacity: expand.value > 0 ? 1 : 0,
  }));

  /* In the capture the column is never faded: at t=6.80 cards 1 and 2 are
     still fully opaque above the growing photo, and the left-hand type is
     still legible at 7.20. The photo just covers them. */
  const homeStyle = useAnimatedStyle(() => ({ opacity: 1 }));

  const record = open === null ? null : RECORDS[open];

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={open === null ? 'dark' : 'light'} />

      <Animated.View style={[StyleSheet.absoluteFill, homeStyle]}>
        <HomeScreen
          scrollY={scrollY}
          focusIndex={focusIndex}
          cardsIn={deal}
          scan={scan}
          expand={expand}
          intro={intro}
          onOpen={openCard}
        />
      </Animated.View>

      {record && (
        <>
          <Animated.View style={[styles.hero, heroStyle]}>
            <Animated.Image
              source={record.full ?? record.image}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </Animated.View>

          <Pressable style={StyleSheet.absoluteFill} onPress={closeCard} />

          <DetailScreen record={record} chrome={chrome} onClose={closeCard} />
        </>
      )}

      {/* the left-hand type outlives the growth: the photo opens underneath
          it and it is only cleared afterwards */}
      <LeftRail intro={intro} railGo={railGo} />

      {/* Both right-hand tabs live above the screens and outlast the expand,
          exactly as in the capture: opening a card slides the photo up behind
          them, it never displaces or replays them. */}
      <UserBadge />
      <RightRail />

      <View style={styles.barSlot} pointerEvents="box-none">
        {/* the pill carries its white container on the home screen too, not just
            once a background has been picked */}
        {/* the pill only exists over a photo — on the paper home screen the
            capture shows the controls sitting bare, no white slab */}
        <ExploreBar progress={progress} floating={barFloating} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  hero: { position: 'absolute', overflow: 'hidden', backgroundColor: colors.sky },
  heroImage: { width: '100%', height: '100%' },
  barSlot: { position: 'absolute', left: 0, right: 0, bottom: u(24) },
});
