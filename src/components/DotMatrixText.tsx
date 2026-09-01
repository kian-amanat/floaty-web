import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme';

/* 5x7 cells per glyph — the clock and the readout in the capture are both
   drawn on a dot lattice rather than set in a typeface, so they are built
   here rather than shipped as a font. */
const GLYPHS: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ':': ['00000', '00100', '00100', '00000', '00100', '00100', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

type Props = {
  text: string;
  cell: number;       // size of one lit dot
  gap?: number;       // lattice spacing between dot centres
  color?: string;
  letterGap?: number; // blank columns between glyphs
};

export default function DotMatrixText({
  text,
  cell,
  gap = cell * 1.32,
  color = colors.ink,
  letterGap = 1.4,
}: Props) {
  const chars = text.toUpperCase().split('');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {chars.map((ch, ci) => {
        const rows = GLYPHS[ch] ?? GLYPHS[' '];
        return (
          <View
            key={`${ch}-${ci}`}
            style={{
              width: gap * 5,
              height: gap * 7,
              marginRight: ci === chars.length - 1 ? 0 : gap * letterGap - gap,
            }}
          >
            {rows.map((row, ry) =>
              row.split('').map((bit, rx) =>
                bit === '1' ? (
                  <View
                    key={`${rx}-${ry}`}
                    style={{
                      position: 'absolute',
                      left: rx * gap,
                      top: ry * gap,
                      width: cell,
                      height: cell,
                      backgroundColor: color,
                    }}
                  />
                ) : null
              )
            )}
          </View>
        );
      })}
    </View>
  );
}
