import React from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing, SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/* The emblem on the left rail.

   The glyph is COMPLETE from the first frame — no entrance, no fade, no
   scale, no movement of the mark as a whole. Measured on the raw frames its
   bounding box holds at 23x23 and its darkest pixel is 0 from frame zero.

   What does move is the interior. Reading the white gaps along a row through
   the interior, frame by frame at 30fps:

       t=0.00   gap 8-13   (wide)
       t=0.50   gap 9-13
       t=0.70   gap 11-13  (narrowest)
       t=0.80   gaps 7-8  12-13  17-18   (re-formed)

   The gap's left edge marches right, 8 -> 9 -> 10 -> 11, while its right edge
   stays put — a vertical line sweeping rightward and eating the white cell,
   then the pattern re-forming. About one cell per 0.37s.

   So: the pair of verticals at columns 2 and 6 stay put, and they and the
   left limb each throw off a copy that travels right and is gone on reaching
   the right limb. Four states, deterministic, looping. Nothing here is
   random and nothing interpolates — a cell is either on or off, so the
   pixels stay square. */
const GRID: string[][] = [
  ['..#####..', '.##...##.', '#.#...#.#', '#.#...#.#', '#########', '#.#...#.#', '#.#...#.#', '.##...##.', '..#####..'],
  ['..#####..', '.###..##.', '####..###', '####..###', '#########', '####..###', '####..###', '.###..##.', '..#####..'],
  ['..#####..', '.##.#.##.', '#.#.#.#.#', '#.#.#.#.#', '#########', '#.#.#.#.#', '#.#.#.#.#', '.##.#.##.', '..#####..'],
  ['..#####..', '.###.###.', '#.##.##.#', '#.##.##.#', '#########', '#.##.##.#', '#.##.##.#', '.###.###.', '..#####..'],
];

const G = 9;
const STEPS = GRID.length;
const CYCLE_MS = 2800;   // ~0.70s a step. The capture measures ~0.37s a
                         // step (1480 for the cycle); this is deliberately
                         // slower than that, by preference.

/* every cell that is lit in any state, with the states it belongs to */
type Cell = { x: number; y: number; on: boolean[] };
const CELLS: Cell[] = [];
for (let y = 0; y < G; y++) {
  for (let x = 0; x < G; x++) {
    const on = GRID.map((g) => g[y][x] === '#');
    if (on.some(Boolean)) CELLS.push({ x, y, on });
  }
}

function Pixel({ cell, phase, fill }: { cell: Cell; phase: SharedValue<number>; fill: string }) {
  const props = useAnimatedProps(() => ({
    opacity: cell.on[Math.floor(phase.value) % STEPS] ? 1 : 0,
  }));
  return (
    <AnimatedRect
      x={cell.x} y={cell.y} width={1.02} height={1.02}
      fill={fill} animatedProps={props}
    />
  );
}

export default function PixelMark({ size, color = colors.ink }: { size: number; color?: string }) {
  const phase = useSharedValue(0);

  React.useEffect(() => {
    phase.value = withRepeat(
      withTiming(STEPS, { duration: CYCLE_MS, easing: Easing.linear }), -1, false
    );
  }, [phase]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${G} ${G}`}>
        {CELLS.map((cell, i) => (
          <Pixel key={i} cell={cell} phase={phase} fill={color} />
        ))}
      </Svg>
    </View>
  );
}
