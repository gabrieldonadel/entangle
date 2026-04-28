/* Shared atoms used across the page */

type IconProps = { size?: number };

export const Logo = ({ size = 28 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" style={{ display: "block" }}>
    <defs>
      <radialGradient id="logo-orb" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="var(--orb-stop-0)" />
        <stop offset="55%" stopColor="var(--orb-stop-1)" />
        <stop offset="100%" stopColor="var(--orb-stop-2)" />
      </radialGradient>
    </defs>
    <circle cx="328" cy="512" r="113" fill="var(--halo-color)" opacity="0.10" />
    <circle cx="696" cy="512" r="92" fill="var(--halo-color)" opacity="0.10" />
    <path
      d="M 328 512 Q 420 384 512 512 T 696 512"
      stroke="var(--halo-color)"
      strokeWidth="40"
      fill="none"
      strokeLinecap="round"
      opacity="0.65"
    />
    <circle cx="328" cy="512" r="87" fill="url(#logo-orb)" />
    <circle cx="696" cy="512" r="72" fill="url(#logo-orb)" />
    <ellipse cx="302" cy="471" rx="28" ry="18" fill="#FFFFFF" opacity="0.78" />
    <ellipse cx="676" cy="486" rx="23" ry="15" fill="#FFFFFF" opacity="0.72" />
  </svg>
);

export const GitHubIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55 0-.27-.01-.99-.01-1.95-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.27-1.69-1.27-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.95.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.49 3.14-1.18 3.14-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.13 0 1.54-.01 2.78-.01 3.16 0 .31.21.67.8.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
  </svg>
);

export const AppleIcon = ({ size = 18 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

export const StarIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const ArrowRight = ({ size = 14 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

type CursorIconProps = IconProps & { color?: string };

export const CursorIcon = ({ size = 22, color = "#fff" }: CursorIconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}
  >
    <path
      d="M5 3 L5 19 L9.5 14.5 L12.2 21 L14.6 20 L11.9 13.5 L18 13.5 Z"
      fill={color}
      stroke="#000"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  </svg>
);

/* Quantum-wave SVG used in hero between phone and Mac */
type ConnectingWaveProps = { animated?: boolean; className?: string };

export const ConnectingWave = ({
  animated = true,
  className = "",
}: ConnectingWaveProps) => (
  <svg
    className={className}
    viewBox="0 0 800 200"
    preserveAspectRatio="none"
    style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
  >
    <defs>
      <linearGradient id="wave-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
        <stop offset="20%" stopColor="var(--accent)" stopOpacity="0.9" />
        <stop offset="80%" stopColor="var(--accent)" stopOpacity="0.9" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </linearGradient>
      <filter id="wave-glow">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    <path
      d="M 40 100 Q 220 0 400 100 T 760 100"
      stroke="var(--accent)"
      strokeOpacity="0.25"
      strokeWidth="14"
      fill="none"
      strokeLinecap="round"
      filter="url(#wave-glow)"
    />
    <path
      d="M 40 100 Q 220 0 400 100 T 760 100"
      stroke="url(#wave-grad)"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    {animated && (
      <circle r="5" fill="var(--accent)">
        <animateMotion
          dur="2.6s"
          repeatCount="indefinite"
          rotate="auto"
          path="M 40 100 Q 220 0 400 100 T 760 100"
        />
        <animate
          attributeName="opacity"
          values="0;1;1;0"
          dur="2.6s"
          repeatCount="indefinite"
        />
      </circle>
    )}
    {animated && (
      <circle r="3" fill="var(--accent)" opacity="0.6">
        <animateMotion
          dur="2.6s"
          begin="1.3s"
          repeatCount="indefinite"
          rotate="auto"
          path="M 40 100 Q 220 0 400 100 T 760 100"
        />
        <animate
          attributeName="opacity"
          values="0;0.7;0.7;0"
          dur="2.6s"
          begin="1.3s"
          repeatCount="indefinite"
        />
      </circle>
    )}
  </svg>
);
