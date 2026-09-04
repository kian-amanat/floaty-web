import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/*
 * ============================================================
 * GLYPH
 * ============================================================
 */

const GRID = [
  '..#####..',
  '.#.#.#.#.',
  '#.#...#.#',
  '#.#...#.#',
  '#########',
  '#.#...#.#',
  '#.#...#.#',
  '.#.#.#.#.',
  '..#####..',
];

const G = 9;

/*
 * Original vertical positions.
 *
 * These stay completely STATIC.
 */
const SOURCE_LINES = [0, 2, 6];

/*
 * Horizontal movement of the copies.
 */
const TRAVEL_DISTANCE = 3;

/*
 * Speed of the moving copies.
 */
const MOVE_DURATION = 1250;


/* ============================================================
 * STATIC GLYPH
 * ============================================================
 */

function StaticGlyph({
  color,
}: {
  color: string;
}) {
  return (
    <>
      {GRID.map((row, y) =>
        [...row].map((pixel, x) => {
          if (pixel !== '#') return null;

          return (
            <Rect
              key={`static-${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={color}
            />
          );
        }),
      )}
    </>
  );
}


/* ============================================================
 * MOVING COPY
 * ============================================================
 *
 * IMPORTANT:
 *
 * Every moving copy has EXACTLY the same height as the
 * SHORT FIRST VERTICAL LINE.
 *
 * Reference:
 *
 *   █
 *   █
 *   █
 *   █
 *   █
 *
 * 5 pixels tall.
 *
 * It does NOT copy the taller 7-pixel lines.
 */

function MovingLineCopy({
  sourceX,
  progress,
  color,
}: {
  sourceX: number;
  progress: SharedValue<number>;
  color: string;
}) {
  /*
   * EXACT height of the short first line.
   *
   * y = 2 → 6
   */
  const Y_POSITIONS = [2, 3, 4, 5, 6];

  return (
    <>
      {Y_POSITIONS.map((y) => {
        const animatedProps = useAnimatedProps(() => {
          /*
           * Continuous phase.
           *
           * The modulo is calculated on the UI thread,
           * so the visible copy wraps without React
           * getting involved.
           */
          const cycle = progress.value % 1;

          return {
            x: sourceX + cycle * TRAVEL_DISTANCE,
          };
        });

        return (
          <AnimatedRect
            key={`${sourceX}-${y}`}
            y={y}
            width={1}
            height={1}
            fill={color}
            animatedProps={animatedProps}
          />
        );
      })}
    </>
  );
}


/* ============================================================
 * COMPONENT
 * ============================================================
 */

export default function PixelMark({
  size,
  color = colors.ink,
}: {
  size: number;
  color?: string;
}) {
  /*
   * We don't repeatedly animate 0 → 1 → reset → 0.
   *
   * Instead we continuously advance the phase.
   *
   * This removes the little visible hitch at the loop.
   */
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1000, {
        duration: MOVE_DURATION * 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      progress.value = 0;
    };
  }, [progress]);

  return (
    <View
      style={{
        width: size,
        height: size,
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${G} ${G}`}
      >
        {/* ================================================= */}
        {/* STATIC ORIGINAL GLYPH                            */}
        {/* ================================================= */}

        <StaticGlyph color={color} />

        {/* ================================================= */}
        {/* MOVING COPIES                                    */}
        {/* ================================================= */}

        {SOURCE_LINES.map((sourceX) => (
          <MovingLineCopy
            key={sourceX}
            sourceX={sourceX}
            progress={progress}
            color={color}
          />
        ))}
      </Svg>
    </View>
  );
}