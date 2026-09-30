export interface TrackpadLayout {
  isLandscape: boolean;
  rootPaddingVertical: number;
  headerPaddingVertical: number;
  serverNameFontSize: number;
}

export function getTrackpadLayout(width: number, height: number): TrackpadLayout {
  const isLandscape = width > height;

  return {
    isLandscape,
    rootPaddingVertical: isLandscape ? 8 : 16,
    headerPaddingVertical: isLandscape ? 2 : 8,
    serverNameFontSize: isLandscape ? 18 : 22,
  };
}
