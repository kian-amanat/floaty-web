import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedRef, useAnimatedStyle, useDerivedValue, withTiming, withDelay, withSequence,
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
  colors, u, SCREEN, CARD, FOCUS_W, FOCUS_H, FOCUS_R, SLOT, FOCUS_Y, LEAD, REST_INDEX,
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
  /* the column is parked a lead's worth in, so the scan's resting card is the
     one squared on the first frame rather than card 1 */
  const scrollY = useSharedValue(u(LEAD));
  const focusIndex = useSharedValue(REST_INDEX);
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

  /* the column, so the tab's marks can drive it */
  const list = useAnimatedRef<Animated.ScrollView>();
  const cardAt = useCallback(
    (k: number) => u(LEAD) + (k - REST_INDEX) * u(SLOT),
    [],
  );
  const scrollToCard = useCallback((k: number, animated = true) => {
    list.current?.scrollTo({ y: cardAt(k), animated });
  }, [list, cardAt]);
  const focusedCard = useCallback(() => {
    const i = Math.round(scan.value + (scrollY.value - u(LEAD)) / u(SLOT));
    return Math.max(0, Math.min(RECORDS.length - 1, i));
  }, [scan, scrollY]);

  /* the intro sweep, kept callable so the tab can run it again */
  const sweep = useCallback((delay: number) => {
    const step = Easing.inOut(Easing.cubic);   // no velocity jump between steps
    const rest = Easing.out(Easing.cubic);     // the measured settle onto card 3
    scan.value = withDelay(delay, withSequence(
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
  }, [scan]);

  useEffect(() => {
    intro.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) });
    sweep(2000);
    deal.forEach((v, i) => {
      /* measured off the capture: first card leaves the bottom edge at t=0
         and each next one follows 390ms later, taking ~1.3s to coast into
         its slot on a long ease-out */
      v.value = withDelay(
        i * 390,
        withTiming(1, { duration: 1300, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      );
    });
  }, [deal, intro, sweep]);

  /* The handle is not parked at zero while the column deals in — the capture
     has it already 19% along at t=1.0 and creeping to 52% by t=3.0, where it
     sits once everything has landed (track 140..366, handle 182 -> 258). So
     the launch sweep owns it first and scroll takes over from there. */
  const progress = useDerivedValue(() => {
    const max = u(SLOT) * (RECORDS.length - 1);
    /* measured from the resting position, which now sits mid-track rather than
       at zero — so the handle still reads 52% at rest, runs to 1 at the bottom
       of the column and back to ~0.04 at the top. */
    const scroll = max > 0 ? (scrollY.value - u(LEAD)) / max : 0;
    const settled = 0.19 + 0.33 * intro.value;
    return Math.min(1, Math.max(0, settled + scroll * 0.96));
  });

  const focusY = SCREEN.h * FOCUS_Y;
  const padTop = focusY - u(SLOT) / 2;

  /* The photo grows out of the card that was actually tapped, so the origin has
     to be that card's real geometry — not the focused card's. Only the squared
     one is FOCUS_W x FOCUS_H with a 38 corner; every other card in the column
     is a CARD-diameter circle, so starting the hero at the squircle meant
     opening a circle popped shape and size in a single frame. The column also
     lays out centred on the screen, not on COLUMN_X, which was a further 4-unit
     jump sideways. */
  const [origin, setOrigin] = useState(() => ({
    left: SCREEN.w / 2 - u(FOCUS_W) / 2,
    top: focusY - u(FOCUS_H) / 2,
    w: u(FOCUS_W),
    h: u(FOCUS_H),
    r: u(FOCUS_R),
  }));

  /* the rail does not leave with the photo — it holds through the whole grow
     and only then walks off, the mark first and quickest */
  const railGo = useSharedValue(0);

  const openCard = useCallback((i: number) => {
    /* the same t the card itself uses, so the hero starts as whatever that card
       is right now — circle, squircle, or part way between */
    const focused = scan.value + (scrollY.value - u(LEAD)) / u(SLOT);
    const t = Math.max(0, Math.min(1, 1 - Math.abs(focused - i)));
    const sx = CARD / FOCUS_W + t * (1 - CARD / FOCUS_W);
    const sy = CARD / FOCUS_H + t * (1 - CARD / FOCUS_H);
    const w = u(FOCUS_W) * sx;
    const h = u(FOCUS_H) * sy;
    /* the card rounds an unscaled box and then scales it, so the corner you
       actually see is the radius times the scale — at t=0 that lands on
       CARD/2, i.e. the circle */
    const r = (u(FOCUS_W) / 2 + t * (u(FOCUS_R) - u(FOCUS_W) / 2)) * sx;
    const cy = padTop + u(LEAD) + i * u(SLOT) + u(SLOT) / 2 - scrollY.value;
    setOrigin({ left: SCREEN.w / 2 - w / 2, top: cy - h / 2, w, h, r });
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
  }, [expand, chrome, railGo, padTop, scrollY, scan]);

  const closeCard = useCallback(() => {
    chrome.value = withTiming(0, { duration: 200 });
    railGo.value = withTiming(0, { duration: 260 });
    expand.value = withTiming(0, SHUT, (done) => {
      if (done) runOnJS(setOpen)(null);
    });
    setBarFloating(false);
  }, [expand, chrome, railGo]);

  /* The tab's three marks. The capture shows the selected state but never a
     press, so what each one DOES is a choice, not a measurement — all three
     drive machinery the screen already has rather than inventing new surface. */
  const onFrame = useCallback(() => {
    if (open !== null) { closeCard(); return; }
    openCard(focusedCard());
  }, [open, closeCard, openCard, focusedCard]);

  const onLibrary = useCallback(() => {
    if (open !== null) closeCard();
    scrollToCard((focusedCard() + 1) % RECORDS.length);
  }, [open, closeCard, scrollToCard, focusedCard]);

  const onCapture = useCallback(() => {
    if (open !== null) closeCard();
    scrollToCard(REST_INDEX);
    sweep(0);
  }, [open, closeCard, scrollToCard, sweep]);

  /* the tapped card becomes the detail backdrop */
  const heroStyle = useAnimatedStyle(() => ({
    left: interpolate(expand.value, [0, 1], [origin.left, 0], Extrapolation.CLAMP),
    top: interpolate(expand.value, [0, 1], [origin.top, 0], Extrapolation.CLAMP),
    width: interpolate(expand.value, [0, 1], [origin.w, SCREEN.w], Extrapolation.CLAMP),
    height: interpolate(expand.value, [0, 1], [origin.h, SCREEN.h], Extrapolation.CLAMP),
    borderRadius: interpolate(expand.value, [0, 1], [origin.r, 0], Extrapolation.CLAMP),
    opacity: expand.value > 0 ? 1 : 0,
  }));

  /* The card and the hero are different crops of the same photo — 640x640 for
     the thumbnail, 900x1950 for the full frame — so under `cover` in the
     182x179 card box they frame completely different things: the thumbnail
     shows the whole square, the full frame shows a 45% band across its middle.
     Cutting from one to the other at expand 0 was the jump on close. The card's
     own thumbnail now sits underneath the full frame for the whole travel and
     the full frame fades over it across a short window just off the bottom, so
     what the hero shows at the hand-off is exactly what the card underneath is
     already showing. Short window on purpose: it is a blend of two different
     crops, so it reads as a soft settle rather than a double exposure. */
  const fullFade = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.05, 0.20], [0, 1], Extrapolation.CLAMP),
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
          listRef={list}
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
              source={record.image}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <Animated.Image
              source={record.full ?? record.image}
              style={[styles.heroFull, fullFade]}
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
      <RightRail onFrame={onFrame} onLibrary={onLibrary} onCapture={onCapture} />

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
  heroFull: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' },
  barSlot: { position: 'absolute', left: 0, right: 0, bottom: u(24) },
});
