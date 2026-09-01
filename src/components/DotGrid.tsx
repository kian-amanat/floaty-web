import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect } from 'react-native-svg';
import { colors, u, SCREEN } from '../theme';

/** The lattice the whole home screen sits on. One SVG pattern, not a few
 *  hundred Views, so it costs nothing to scroll over.
 *
 *  react-native-svg on web ignores a style-only size and falls back to the SVG
 *  default of 300x150, which left the grid covering only the top corner — so
 *  the size is passed as explicit props as well. Pitch is measured off the
 *  capture: the dots sit about 56 reference units apart in both axes. */
export default function DotGrid({
  pitch = 56,
  opacity = 1,
  width = SCREEN.w,
  height = SCREEN.h,
}: {
  pitch?: number;
  opacity?: number;
  width?: number;
  height?: number;
}) {
  const p = u(pitch);
  return (
    <Svg
      width={width}
      height={height}
      style={[StyleSheet.absoluteFill, { opacity }]}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id="dots" width={p} height={p} patternUnits="userSpaceOnUse">
          <Circle cx={p / 2} cy={p / 2} r={u(1.8)} fill={colors.faint} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill="url(#dots)" />
    </Svg>
  );
}
