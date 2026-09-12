import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, u } from '../theme';

/**
 * RIGHT RAIL — REFERENCE PARITY
 *
 * Reference coordinate system: 430 x 932
 *
 * FINAL GEOMETRY
 * ------------------------------------------------------------
 * Rear slab:
 *   x: 395 -> 430   = 35px
 *   y: 524 -> 793   = 269px
 *
 * Front slab:
 *   x: 387 -> 430   = 43px
 *   y: 540 -> 779   = 239px
 *
 * The entire rail is anchored to the RIGHT EDGE.
 *
 * IMPORTANT:
 * Never center this component relative to the main composition.
 * It belongs to the viewport/right edge.
 */

/* ============================================================
 * GEOMETRY
 * ========================================================== */

const RAIL_W = 43;

const BACK_W = 35;
const BACK_H = 269;
const BACK_CHAMFER = 42;

const FRONT_TOP = 16;       // 524 + 16 = 540
const FRONT_H = 239;        // 540 -> 779

const SLOT_TOP = 524;

/**
 * Glyph centers in absolute reference coordinates:
 *
 * top framing     ≈ 607
 * folder          ≈ 663
 * bottom capture  ≈ 719
 *
 * Relative to SLOT_TOP = 524:
 * 607 - 524 = 83
 * 663 - 524 = 139
 * 719 - 524 = 195
 */
const MARK_TOP = 83;
const MARK_FOLDER = 139;
const MARK_BOTTOM = 195;

const HIT = 40;

const FRONT_R = 4;
const BACK_R = 2.5;

const DIM = '#6B6B70';

/* ============================================================
 * TIMELINE
 * ========================================================== */

/**
 * T is NOT a conventional 0 -> 1 progress value.
 *
 * It represents absolute animation time in seconds:
 *
 *   0.00
 *   1.06
 *   1.47
 *   1.77
 *   1.80
 *   ...
 *   2.60
 *
 * Keeping absolute time here makes the animation much easier
 * to match against the reference video frame-by-frame.
 */

const PANEL_KEYS = [
  1.06,
  1.13,
  1.20,
  1.30,
  1.45,
  1.60,
  1.80,
  2.00,
  2.30,
  2.60,
];

/**
 * Reference-measured vertical growth.
 *
 * Height leads width significantly.
 */
const SCALE_Y = [
  0.00,
  0.40,
  0.61,
  0.84,
  0.89,
  0.93,
  0.95,
  0.97,
  0.98,
  1.00,
];

/**
 * Width trails height.
 */
const SCALE_X = [
  0.00,
  0.10,
  0.22,
  0.60,
  0.77,
  0.86,
  0.92,
  0.96,
  0.99,
  1.00,
];

/* ============================================================
 * PATH HELPERS
 * ========================================================== */

type Pt = {
  x: number;
  y: number;
};

function roundedPath(points: Pt[], radius: number): string {
  const n = points.length;
  let d = '';

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const current = points[i];
    const next = points[(i + 1) % n];

    const prevDistance = Math.hypot(
      prev.x - current.x,
      prev.y - current.y,
    );

    const nextDistance = Math.hypot(
      next.x - current.x,
      next.y - current.y,
    );

    const r = Math.min(
      radius,
      prevDistance / 2,
      nextDistance / 2,
    );

    const from = {
      x:
        current.x +
        ((prev.x - current.x) / prevDistance) * r,
      y:
        current.y +
        ((prev.y - current.y) / prevDistance) * r,
    };

    const to = {
      x:
        current.x +
        ((next.x - current.x) / nextDistance) * r,
      y:
        current.y +
        ((next.y - current.y) / nextDistance) * r,
    };

    d += `${i === 0 ? 'M' : 'L'}${from.x.toFixed(2)} ${from.y.toFixed(2)} `;
    d += `Q${current.x.toFixed(2)} ${current.y.toFixed(2)} `;
    d += `${to.x.toFixed(2)} ${to.y.toFixed(2)} `;
  }

  return `${d}Z`;
}

/* ============================================================
 * REFERENCE SHAPES
 * ========================================================== */

/**
 * Rear slab
 *
 * Final:
 * x = 8 .. 43
 * y = 0 .. 269
 *
 * This produces the stepped silhouette visible behind the
 * wider front slab.
 */
const BACK_PATH = roundedPath(
  [
    { x: RAIL_W, y: 0 },
    { x: RAIL_W - BACK_W, y: BACK_CHAMFER },
    { x: RAIL_W - BACK_W, y: BACK_H - BACK_CHAMFER },
    { x: RAIL_W, y: BACK_H },
  ],
  BACK_R,
);

/**
 * Front slab
 *
 * Absolute final coordinates:
 * y = 540 -> 779
 *
 * Relative to SLOT_TOP = 524:
 * y = 16 -> 255
 */
const FRONT_PATH = roundedPath(
  [
    { x: RAIL_W, y: FRONT_TOP },
    { x: 0, y: FRONT_TOP + RAIL_W },
    { x: 0, y: FRONT_TOP + FRONT_H - RAIL_W },
    { x: RAIL_W, y: FRONT_TOP + FRONT_H },
  ],
  FRONT_R,
);

/* ============================================================
 * MARK
 * ========================================================== */

function Mark({
  top,
  animation,
  selected,
  label,
  onPress,
  children,
}: {
  top: number;
  animation: any;
  selected: boolean;
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Animated.View
      style={[
        styles.mark,
        {
          top: u(top - HIT / 2),
        },
        animation,
      ]}
    >
      <Pressable
        onPress={onPress}
        hitSlop={u(6)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.hit,
          pressed && styles.hitDown,
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ============================================================
 * COMPONENT
 * ========================================================== */

export default function RightRail({
  at,
  onFrame,
  onLibrary,
  onCapture,
}: {
  at?: number;
  onFrame?: () => void;
  onLibrary?: () => void;
  onCapture?: () => void;
}) {
  /**
   * IMPORTANT:
   *
   * T represents absolute seconds in the animation timeline.
   *
   * Do not use a 0 -> 1 progress value here.
   */
  const T = useSharedValue(at ?? 0);

  const [active, setActive] = useState(1);

  const actions = [
    onFrame,
    onLibrary,
    onCapture,
  ];

  const press = (index: number) => {
    setActive(index);
    actions[index]?.();
  };

  /* ==========================================================
   * PANEL TIMELINE
   * ======================================================== */

  useEffect(() => {
    if (at !== undefined) {
      T.value = at;
      return;
    }

    /**
     * Reference panel becomes fully established around 2.60s.
     *
     * Keep this linear because the measured SCALE_X / SCALE_Y
     * arrays already encode the reference acceleration profile.
     *
     * DO NOT add another easing curve here — it would distort
     * the measured timeline.
     */
    /* Still linear, for the reason above — the duration only sets how fast
       the measured timeline is read, which is what brings the rail in at
       1.4s rather than 2.6. */
    T.value = withTiming(2.6, {
      duration: 1400,
      easing: Easing.linear,
    });
  }, [T, at]);

  /* ==========================================================
   * PANEL
   * ======================================================== */

  const panelStyle = useAnimatedStyle(() => {
    const sx = interpolate(
      T.value,
      PANEL_KEYS,
      SCALE_X,
      Extrapolation.CLAMP,
    );

    const sy = interpolate(
      T.value,
      PANEL_KEYS,
      SCALE_Y,
      Extrapolation.CLAMP,
    );

    /**
     * Right edge must remain absolutely fixed.
     *
     * React Native scales around the center, so compensate by
     * half of the lost width.
     */
    const rightEdgeCompensation =
      (u(RAIL_W) / 2) * (1 - sx);

    return {
      opacity: T.value >= 1.06 ? 1 : 0,

      transform: [
        {
          translateX: rightEdgeCompensation,
        },
        {
          scaleX: sx,
        },
        {
          scaleY: sy,
        },
      ],
    };
  });

  /* ==========================================================
   * GLYPH ANIMATIONS
   * ======================================================== */

  /**
   * BOTTOM CAPTURE / CAMERA
   *
   * Reference:
   * starts ≈ 1.47s
   * reaches full shortly after.
   */
  const captureStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      T.value,
      [1.47, 1.85],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
    };
  });

  /**
   * TOP FRAMING / RETICLE
   *
   * Reference:
   * starts ≈ 1.77s
   */
  const framingStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      T.value,
      [1.77, 2.10],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
    };
  });

  /**
   * MIDDLE FOLDER
   *
   * The reference does NOT simply fade this icon in.
   *
   * It grows into its final area.
   */
  const folderStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      T.value,
      [
        1.80,
        1.90,
        2.00,
        2.10,
        2.20,
        2.30,
      ],
      [
        0.00,
        0.57,
        0.77,
        0.86,
        0.94,
        1.00,
      ],
      Extrapolation.CLAMP,
    );

    return {
      opacity: scale > 0.02 ? 1 : 0,

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
          PANEL
         =================================================== */}

      <Animated.View
        style={[
          styles.panel,
          panelStyle,
        ]}
        pointerEvents="none"
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${RAIL_W} ${BACK_H}`}
          preserveAspectRatio="none"
        >
          {/* Rear slab first */}
          <Path
            d={BACK_PATH}
            fill={colors.panel}
          />

          {/* Front slab second */}
          <Path
            d={FRONT_PATH}
            fill={colors.panel}
          />
        </Svg>
      </Animated.View>

      {/* =====================================================
          TOP — FRAMING
         =================================================== */}

      <Mark
        top={MARK_TOP}
        animation={framingStyle}
        selected={active === 0}
        onPress={() => press(0)}
        label="Framing"
      >
        <Svg
          width={u(18)}
          height={u(18)}
          viewBox="0 0 24 24"
        >
          <Path
            d="
              M3 8.4V3.4H8
              M21 8.4V3.4H16
              M3 15.6V20.6H8
              M21 15.6V20.6H16
            "
            stroke={
              active === 0
                ? colors.white
                : DIM
            }
            strokeWidth="2.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Mark>

      {/* =====================================================
          MIDDLE — LIBRARY
         =================================================== */}

      <Mark
        top={MARK_FOLDER}
        animation={folderStyle}
        selected={active === 1}
        onPress={() => press(1)}
        label="Library"
      >
        <Svg
          width={u(21)}
          height={u(16)}
          viewBox="0 0 24 18"
        >
          <Path
            d="
              M2.4 2
              L8.8 2
              L11.2 4.8
              L21.6 4.8
              A1.2 1.2 0 0 1 22.8 6
              L22.8 14.8
              A1.2 1.2 0 0 1 21.6 16
              L2.4 16
              A1.2 1.2 0 0 1 1.2 14.8
              L1.2 3.2
              A1.2 1.2 0 0 1 2.4 2
              Z
            "
            fill={
              active === 1
                ? colors.white
                : DIM
            }
          />
        </Svg>
      </Mark>

      {/* =====================================================
          BOTTOM — CAPTURE
         =================================================== */}

      <Mark
        top={MARK_BOTTOM}
        animation={captureStyle}
        selected={active === 2}
        onPress={() => press(2)}
        label="Capture"
      >
        <Svg
          width={u(19)}
          height={u(19)}
          viewBox="0 0 24 24"
        >
          <Rect
            x="3"
            y="5.6"
            width="18"
            height="13.6"
            rx="2.4"
            stroke={
              active === 2
                ? colors.white
                : DIM
            }
            strokeWidth="2.3"
            fill="none"
          />

          <Circle
            cx="12"
            cy="12.4"
            r="3.3"
            stroke={
              active === 2
                ? colors.white
                : DIM
            }
            strokeWidth="2.3"
            fill="none"
          />
        </Svg>
      </Mark>
    </View>
  );
}

/* ==============================================================
 * STYLES
 * ============================================================== */

const styles = StyleSheet.create({
  /**
   * THIS IS CRITICAL.
   *
   * The rail belongs to the viewport, not the content/image.
   *
   * right: 0 must stay unchanged.
   */
  slot: {
    position: 'absolute',
    right: 0,
    top: u(SLOT_TOP),

    width: u(RAIL_W),
    height: u(BACK_H),

    zIndex: 20,
  },

  panel: {
    position: 'absolute',

    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },

  mark: {
    position: 'absolute',

    left: 0,
    right: 0,

    height: u(HIT),

    alignItems: 'center',
    justifyContent: 'center',
  },

  hit: {
    width: u(HIT),
    height: u(HIT),

    alignItems: 'center',
    justifyContent: 'center',
  },

  hitDown: {
    opacity: 0.5,

    transform: [
      {
        scale: 0.88,
      },
    ],
  },
});