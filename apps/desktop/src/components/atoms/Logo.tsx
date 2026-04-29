import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

export function Logo({size = 28}: {size?: number}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Defs>
        <RadialGradient id="logo-orb" cx="35%" cy="30%" r="75%">
          <Stop offset="0%" stopColor="#d6e4f4" />
          <Stop offset="55%" stopColor="#7393b8" />
          <Stop offset="100%" stopColor="#2c3e58" />
        </RadialGradient>
      </Defs>
      <Circle cx={328} cy={512} r={113} fill="#a3bbd6" opacity={0.1} />
      <Circle cx={696} cy={512} r={92} fill="#a3bbd6" opacity={0.1} />
      <Path
        d="M 328 512 Q 420 384 512 512 T 696 512"
        stroke="#a3bbd6"
        strokeWidth={40}
        fill="none"
        strokeLinecap="round"
        opacity={0.65}
      />
      <Circle cx={328} cy={512} r={87} fill="url(#logo-orb)" />
      <Circle cx={696} cy={512} r={72} fill="url(#logo-orb)" />
      <Ellipse
        cx={302}
        cy={471}
        rx={28}
        ry={18}
        fill="#FFFFFF"
        opacity={0.78}
      />
      <Ellipse
        cx={676}
        cy={486}
        rx={23}
        ry={15}
        fill="#FFFFFF"
        opacity={0.72}
      />
    </Svg>
  );
}
