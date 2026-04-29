export const tokens = {
  bg0: '#0a0c10',
  bg1: '#0e1014',
  bg2: '#14171d',
  surface: 'rgba(255,255,255,0.025)',
  surfaceStrong: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.10)',
  divider: 'rgba(255,255,255,0.05)',
  text: '#f5f7fa',
  textHigh: 'rgba(255,255,255,0.92)',
  textMid: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.35)',
  textFaint: 'rgba(255,255,255,0.18)',
  accent: '#a3bbd6',
  accentDeep: '#7393b8',
  accentGlow: 'rgba(163,187,214,0.18)',
  accentSoft: 'rgba(163,187,214,0.06)',
  accentBorder: 'rgba(163,187,214,0.16)',
  ok: '#34C759',
  okText: '#9bd5a3',
  warn: '#FFB340',
  danger: '#FF453A',

  fontDisplay: 'InterTight-SemiBold',
  fontDisplayBold: 'InterTight-Bold',
  fontBody: 'Inter-Regular',
  fontBodyMedium: 'Inter-Medium',
  fontMono: 'JetBrainsMono-Regular',

  systemDisplay:
    'Inter Tight, -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
  systemBody:
    'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  systemMono: 'JetBrains Mono, ui-monospace, "SF Mono", Menlo, monospace',
} as const;

export const fonts = {
  display: 'System',
  displayBold: 'System',
  body: 'System',
  mono: 'Menlo',
} as const;
