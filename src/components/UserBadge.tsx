import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, mono, u } from '../theme';

/*
 * ============================================================
 * USER BADGE — REFERENCE PARITY
 * ============================================================
 *
 * Coordinate system:
 *   430 x 932 reference units
 *
 * The reference does NOT animate this as a simple expanding
 * rectangle.
 *
 * Timeline:
 *
 * 0.00   hidden
 * 0.30   2px horizontal hairline
 * 1.05   short rounded pill
 * 1.25   pill + label established
 * 1.28   lower white disc begins
 * 1.35   slab starts major expansion
 * 1.45   slab lunges downward and catches disc
 * 1.48   avatar begins appearing
 * 1.55   avatar + lower disc resolving
 * 1.70   main form essentially complete
 * 2.10   settled
 * 2.40   final reference state
 *
 * DO NOT convert this into a generic spring.
 * The reference motion is deterministic and keyed.
 */

/* ============================================================
 * GEOMETRY
 * ========================================================== */

const W = 72;

/*
 * The reference badge is positioned with a 15px right margin.
 */
const RIGHT_MARGIN = 15;

/*
 * Absolute top/bottom coordinates of the black slab.
 *
 * Top moves upward first.
 * Bottom stays near the top for a while and then drops hard.
 */
const KEYS = [
  0.30,
  0.60,
  0.90,
  1.05,
  1.15,
  1.25,
  1.35,
  1.45,
  1.55,
  1.70,
  2.10,
  2.40,
];

const TOPS = [
  112,
  112,
  111,
  103,
   95,
   89,
   87,
   52,
   37,
   35,
   22,
   20,
];

const BOTS = [
  114,
  114,
  114,
  122,
  124,
  125,
  128,
  145,
  168,
  200,
  206,
  206,
];

/*
 * Final slab:
 *
 * top ≈ 20
 * bottom ≈ 206
 * width = 72
 */
const SLOT_H = 215;

/* ============================================================
 * AVATAR
 * ========================================================== */

const AVATAR = 49;

/*
 * Centered around the upper part of the slab.
 */
const AVATAR_Y = 62;

/* ============================================================
 * LOWER DISC
 * ========================================================== */

const BTN = 53;
const BTN_Y = 169;

/* ============================================================
 * TIMING
 * ========================================================== */

/*
 * The lower disc exists BEFORE the slab reaches it.
 *
 * This is important.
 *
 * At ~1.28s:
 *   tiny white disc appears on the paper.
 *
 * At ~1.45s:
 *   disc is still partially outside the slab.
 *
 * Then the slab drops over it.
 */
const BTN_KEYS = [
  1.28,
  1.36,
  1.45,
  1.55,
  1.65,
  1.75,
  1.90,
  2.10,
];

const BTN_SIZE = [
  0,
  6,
  18,
  31,
  40,
  47,
  53,
  53,
];

/* ============================================================
 * LABEL
 * ========================================================== */

const LABEL_START = 0.92;
const LABEL_FULL = 1.18;

/* ============================================================
 * HELPERS
 * ========================================================== */

function lerp(
  value: number,
  input: number[],
  output: number[],
) {
  return interpolate(
    value,
    input,
    output,
    Extrapolation.CLAMP,
  );
}

/* ============================================================
 * COMPONENT
 * ========================================================== */

export default function UserBadge({
  name = 'JACK',
  at,
}: {
  name?: string;
  at?: number;
}) {
  /*
   * Absolute timeline in seconds.
   *
   * This is much easier to compare frame-by-frame than a 0 -> 1
   * normalized animation.
   */
  const T = useSharedValue(at ?? 0);

  useEffect(() => {
    /*
     * Inspection mode.
     */
    if (at !== undefined) {
      T.value = at;
      return;
    }

    /*
     * EXACT REFERENCE CYCLE
     *
     * Reference is visually settled by ~2.4s.
     *
     * Do not use 2.6s here.
     * The extra 200ms makes the whole badge feel late.
     */
    T.value = 0;

    /* T is an index into the measured timeline, so the duration is a speed
       control rather than a curve: the profile is unchanged, it just plays
       faster. Down from 2.4s at the reference rate — the badge is the first
       thing the eye goes to on this screen, so it arriving last was most of
       why the opening read as slow. It now lands with the bottom bar rather
       than a half second behind the rail. */
    T.value = withTiming(2.4, {
      duration: 900,
      easing: Easing.linear,
    });
  }, [T, at]);

  /* ==========================================================
   * SLAB
   * ======================================================== */

  const slabStyle = useAnimatedStyle(() => {
    const top = lerp(
      T.value,
      KEYS,
      TOPS,
    );

    const bottom = lerp(
      T.value,
      KEYS,
      BOTS,
    );

    const height = Math.max(
      0,
      bottom - top,
    );

    /*
     * Before 0.30 the reference has no visible badge.
     *
     * At exactly 0.30 it is a tiny 2px line.
     */
    const opacity =
      T.value >= 0.30
        ? 1
        : 0;

    return {
      top: u(top),
      height: u(height),
      opacity,

      /*
       * This produces the pill during the early state and
       * naturally becomes a vertical rounded capsule later.
       */
      borderRadius: Math.min(
        u(W) / 2,
        u(height) / 2,
      ),
    };
  });

  /* ==========================================================
   * LABEL
   * ======================================================== */

  const labelStyle = useAnimatedStyle(() => {
    const opacity = lerp(
      T.value,
      [LABEL_START, LABEL_FULL],
      [0, 1],
    );

    /*
     * The label sits slightly below the pill center.
     *
     * It moves only a few pixels while the slab changes shape.
     */
    const top = lerp(
      T.value,
      [1.05, 1.25, 1.55, 2.10],
      [98, 99, 102, 102],
    );

    /*
     * Very small upward/downward settle rather than a generic
     * fade-only animation.
     */
    const translateY = lerp(
      T.value,
      [LABEL_START, 1.05, 1.25],
      [3, 1, 0],
    );

    return {
      opacity,

      top: u(top),

      transform: [
        {
          translateY: u(translateY),
        },
      ],
    };
  });

  /* ==========================================================
   * AVATAR
   * ======================================================== */

  const avatarStyle = useAnimatedStyle(() => {
    /*
     * Reference:
     * avatar is essentially absent before ~1.48s.
     */
    const progress = lerp(
      T.value,
      [1.48, 1.60, 1.70, 1.85],
      [0, 0.35, 0.78, 1],
    );

    /*
     * Reference avatar resolves by growing rather than simply
     * appearing.
     */
    const scale = 0.58 + 0.42 * progress;

    return {
      opacity: progress,

      transform: [
        {
          scale,
        },
      ],
    };
  });

  /* ==========================================================
   * LOWER DISC
   * ======================================================== */

  const buttonStyle = useAnimatedStyle(() => {
    const size = lerp(
      T.value,
      BTN_KEYS,
      BTN_SIZE,
    );

    return {
      width: u(size),
      height: u(size),

      /*
       * Center remains locked to the measured reference point.
       */
      left: u(W / 2) - u(size / 2),
      top: u(BTN_Y) - u(size / 2),

      borderRadius: u(size / 2),

      borderWidth:
        size > 0.5
          ? u(1.5)
          : 0,

      opacity:
        size > 0.5
          ? 1
          : 0,
    };
  });

  /* ==========================================================
   * LOWER GLYPH
   * ======================================================== */

  const glyphStyle = useAnimatedStyle(() => {
    /*
     * The glyph follows the disc's growth.
     *
     * It is not visible during the initial tiny disc state.
     */
    const opacity = lerp(
      T.value,
      [1.52, 1.63, 1.80],
      [0, 0.65, 1],
    );

    const scale = lerp(
      T.value,
      [1.52, 1.70, 1.85],
      [0.72, 0.92, 1],
    );

    return {
      opacity,

      transform: [
        {
          scale,
        },
      ],
    };
  });

  /* ==========================================================
   * RENDER
   * ======================================================== */

  return (
    <View
      style={styles.slot}
      pointerEvents="box-none"
    >
      {/* =====================================================
          BLACK SLAB
         =================================================== */}

      <Animated.View
        style={[
          styles.slab,
          slabStyle,
        ]}
      />

      {/* =====================================================
          AVATAR
         =================================================== */}

      <Animated.View
        style={[
          styles.avatar,
          avatarStyle,
        ]}
      >
        <Image
          source={require('../../assets/ui/avatar-jack.jpg')}
          style={styles.avatarImg}
        />
      </Animated.View>

      {/* =====================================================
          LABEL
         =================================================== */}

      <Animated.Text
        style={[
          styles.hi,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        HI, {name}
      </Animated.Text>

      {/* =====================================================
          LOWER WHITE DISC
         =================================================== */}

      <Animated.View
        style={[
          styles.btn,
          buttonStyle,
        ]}
      >
        <View style={styles.btnCore}>
          <Animated.View style={glyphStyle}>
            <Svg
              width={u(13)}
              height={u(13)}
              viewBox="0 0 24 24"
            >
              <Path
                d="
                  M13.6 2
                  L5 13.2
                  h5.3
                  l-1.7 8.8
                  L19 10.6
                  h-5.3
                  z
                "
                fill={colors.white}
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ==============================================================
 * STYLES
 * ============================================================== */

const styles = StyleSheet.create({
  /*
   * IMPORTANT:
   *
   * This belongs to the screen's top-right coordinate system.
   *
   * Do NOT center it relative to the image/list.
   */
  slot: {
    position: 'absolute',

    right: u(RIGHT_MARGIN),
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

    /*
     * The radius is animated from the worklet.
     */
    overflow: 'hidden',
  },

  avatar: {
    position: 'absolute',

    top: u(AVATAR_Y - AVATAR / 2),
    left: u(W / 2 - AVATAR / 2),

    width: u(AVATAR),
    height: u(AVATAR),

    borderRadius: u(AVATAR / 2),

    borderWidth: u(4),
    borderColor: '#BDBBB8',

    overflow: 'hidden',

    backgroundColor: colors.panel,
  },

  avatarImg: {
    width: '100%',
    height: '100%',
  },

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

  /*
   * White lower disc.
   *
   * It appears on the paper BEFORE the black slab reaches it.
   */
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