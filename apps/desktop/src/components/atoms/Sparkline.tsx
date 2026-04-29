import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

type Props = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
};

export function Sparkline({
  data,
  width = 88,
  height = 20,
  color = '#a3bbd6',
}: Props) {
  if (data.length < 2) {
    return <Svg width={width} height={height} />;
  }
  const max = Math.max(...data, 1);
  const last = data.length - 1;
  const points = data
    .map((v, i) => `${(i / last) * width},${height - (v / max) * height}`)
    .join(' ');
  const filled = `0,${height} ${points} ${width},${height}`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={filled} fill={color} fillOpacity={0.08} stroke="none" />
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
