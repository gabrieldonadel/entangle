import qrcodegen from 'qrcode';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

type Props = {
  value: string;
  size?: number;
  accent?: string;
};

export function QRCode({ value, size = 188, accent = '#a3bbd6' }: Props) {
  const matrix = useMemo(() => buildMatrix(value), [value]);
  const cells = matrix.length;
  const cell = size / cells;

  return (
    <View
      style={{
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 14,
      }}>
      <Svg width={size} height={size}>
        <Rect x={0} y={0} width={size} height={size} fill="#fff" />
        {matrix.flatMap((row, y) =>
          row.map((on, x) => {
            if (!on) return null;
            // Skip the center patch where we'll draw the brand dot
            if (
              x >= cells / 2 - 2 &&
              x <= cells / 2 + 2 &&
              y >= cells / 2 - 2 &&
              y <= cells / 2 + 2
            ) {
              return null;
            }
            return (
              <Rect
                key={`${x}-${y}`}
                x={x * cell}
                y={y * cell}
                width={cell}
                height={cell}
                fill="#0a0c10"
              />
            );
          })
        )}
        <Circle cx={size / 2} cy={size / 2} r={cell * 2.5} fill="#fff" />
        <Circle cx={size / 2} cy={size / 2} r={cell * 1.6} fill={accent} />
      </Svg>
    </View>
  );
}

function buildMatrix(value: string): number[][] {
  // qrcode's `create` returns a typed bitmask we can read into a 2-D matrix.
  const qr = qrcodegen.create(value, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const out: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      row.push(data[y * size + x] ? 1 : 0);
    }
    out.push(row);
  }
  return out;
}
