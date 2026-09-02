import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedScrollHandler, useAnimatedStyle,
  interpolate, Extrapolation, SharedValue, AnimatedRef,
} from 'react-native-reanimated';
import DotGrid from '../components/DotGrid';
import { RECORDS } from '../data';
import {
  colors, mono, u, SCREEN, CARD, FOCUS_W, FOCUS_H, FOCUS_R, SLOT, COLUMN_X, FOCUS_Y,
  CARD_ENTRY_Y, LEAD, REST_INDEX,
} from '../theme';

function Item({
  index, scrollY, image, onPress, padTop, focusY, lead, hidden, scan,
}: {
  index: number;
  scrollY: SharedValue<number>;
  image: any;
  onPress: () => void;
  padTop: number;
  focusY: number;
  lead: number;
  hidden: SharedValue<number>;
  scan: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    /* Which card is squared is owned by the scan, offset by however far the
       column has been scrolled. Deriving it from a fixed focus LINE instead
       is what pinned the square to the top card: padTop is defined so that
       index 0 lands on that line, so card 1 sat at distance zero forever.
       The scan rests on 2 — the middle of the column — which is where the
       capture leaves it, and `lead` is the scroll room that sits above that
       resting point. Subtracting it is what lets the first two cards be
       reached: without it scrollY bottomed out at 0 with the scan already on
       2, so the range covered focused 2..6 — cards 4 and 5 plus two dead
       slots — and 0 and 1 were off the negative end. */
    const focused = scan.value + (scrollY.value - lead) / u(SLOT);
    const t = interpolate(Math.abs(focused - index), [0, 1], [1, 0], Extrapolation.CLAMP);

    /* The box stays FOCUS_W x FOCUS_H and the morph rides on transforms, so
       nothing here triggers layout — animating width/height instead costs a
       full layout pass per frame per card, which is what made this drag.
       borderRadius is in unscaled box units, hence the divide-out: at rest it
       lands on FOCUS_W/2, i.e. a true circle once the scale is applied. */
    const sx = interpolate(t, [0, 1], [CARD / FOCUS_W, 1]);
    const sy = interpolate(t, [0, 1], [CARD / FOCUS_H, 1]);
    const r = interpolate(t, [0, 1], [u(FOCUS_W) / 2, u(FOCUS_R)]);

    /* deal-in: every card rises from the same line just off the bottom edge,
       so the ones with furthest to travel move fastest — which is what the
       capture shows. No fade and no scale; they arrive full size. */
    const rest = padTop + index * u(SLOT) + u(SLOT) / 2;
    const travel = u(CARD_ENTRY_Y) - rest;
    return {
      borderRadius: r,
      opacity: hidden.value > 0.001 ? 1 : 0,
      transform: [
        { translateY: travel * (1 - hidden.value) },
        { scaleX: sx },
        { scaleY: sy },
      ],
    };
  });

  return (
    <View style={{ height: u(SLOT), alignItems: 'center', justifyContent: 'center' }}>
      <Pressable onPress={onPress}>
        <Animated.View style={[styles.card, style]}>
          <Animated.Image source={image} style={styles.cardImage} resizeMode="cover" />
        </Animated.View>
      </Pressable>
    </View>
  );
}

export default function HomeScreen({
  listRef, scrollY, onOpen, focusIndex, cardsIn, intro, scan, expand,
}: {
  listRef: AnimatedRef<Animated.ScrollView>;
  scrollY: SharedValue<number>;
  onOpen: (index: number) => void;
  focusIndex: SharedValue<number>;
  cardsIn: SharedValue<number>[];
  scan: SharedValue<number>;
  expand: SharedValue<number>;
  intro: SharedValue<number>;
}) {
  const focusY = SCREEN.h * FOCUS_Y;
  /* screen y of the first slot when the column is at rest — the deal-in still
     measures its travel against this, so it is unaffected by the lead */
  const slotTop = focusY - u(SLOT) / 2;
  const lead = u(LEAD);
  /* the lead is taken out of the bottom padding rather than added to the
     total, so the content height and the overall scroll range are unchanged;
     only the origin moves. The column still rests exactly where it did. */
  const padTop = slotTop + lead;
  const padBottom = Math.max(0, SCREEN.h - focusY - u(SLOT) / 2 - lead);
  /* Owned by App so the right-hand tab can drive the column too. A plain
     useRef does not reach through Animated.ScrollView — scrollTo silently
     no-ops and the list stays at 0 while scrollY reads the lead, so the column
     looks right until the first touch and then jumps two cards. */
  const list = listRef;
  const parked = useRef(false);
  const park = useCallback(() => {
    if (parked.current) return;
    list.current?.scrollTo({ y: lead, animated: false });
  }, [lead, list]);
  /* content size is fixed, so onContentSizeChange alone would do on Android;
     the timeout covers the case where it fires before the ref is attached. */
  useEffect(() => {
    const t = setTimeout(park, 0);
    return () => clearTimeout(t);
  }, [park]);

  /* Opening a card sweeps the left-hand rail off to the right rather than
     dissolving it in place — the date, the mark, the clock and the assignment
     label all travel together and are gone before the photo has finished. */
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    focusIndex.value = Math.round((e.contentOffset.y - lead) / u(SLOT)) + REST_INDEX;
  });

  return (
    <View style={styles.root}>
      <DotGrid />

      {/* the column */}
      <Animated.ScrollView
        ref={list}
        style={StyleSheet.absoluteFill}
        contentOffset={{ x: 0, y: lead }}
        onContentSizeChange={park}
        onMomentumScrollEnd={() => { parked.current = true; }}
        onScrollEndDrag={() => { parked.current = true; }}
        contentContainerStyle={{
          paddingTop: padTop,
          paddingBottom: padBottom,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={u(SLOT)}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {RECORDS.map((r, i) => (
          <Item
            key={r.id}
            index={i}
            scrollY={scrollY}
            image={r.image}
            padTop={slotTop}
            focusY={focusY}
            lead={lead}
            hidden={cardsIn[i]}
            scan={scan}
            onPress={() => onOpen(i)}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.paper },
  card: {
    width: u(FOCUS_W),
    height: u(FOCUS_H),
    overflow: 'hidden',
    backgroundColor: 'rgba(18,17,15,0.06)',
  },
  cardImage: { width: '100%', height: '100%' },
  meta: {
    fontFamily: mono,
    fontSize: u(9),
    lineHeight: u(15),
    letterSpacing: u(1.3),
    color: colors.ink,
  },
  dateBlock: { position: 'absolute', left: u(26), top: u(88), pointerEvents: 'none' },
  mark: { position: 'absolute', left: u(42), top: u(288), pointerEvents: 'none' },
  clock: { position: 'absolute', left: u(20), top: u(452), pointerEvents: 'none' },
  assignment: { position: 'absolute', left: u(30), top: u(612), pointerEvents: 'none' },
});
