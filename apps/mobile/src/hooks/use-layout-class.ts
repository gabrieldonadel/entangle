import { useEffect, useState } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';

/**
 * Material 3 window size classes, keyed on the window's width so Split View,
 * Stage Manager, Android multi-window and foldables all land in the right
 * bucket. They map onto iPad sizes too: portrait is `medium`, landscape is
 * `expanded`.
 */
export type WidthClass = 'compact' | 'medium' | 'expanded';

export const MEDIUM_MIN_WIDTH = 600;
export const EXPANDED_MIN_WIDTH = 840;
// An iPhone on its side. Keyed on height rather than aspect ratio so a wide
// window on a big screen keeps the roomy layout.
export const SHORT_MAX_HEIGHT = 500;
// Android's sw600dp: the smallest screen side of a tablet or an unfolded
// foldable.
export const LARGE_SCREEN_MIN_SIDE = 600;

export function widthClassFor(width: number): WidthClass {
  if (width >= EXPANDED_MIN_WIDTH) return 'expanded';
  if (width >= MEDIUM_MIN_WIDTH) return 'medium';
  return 'compact';
}

export function useLayoutClass(): { widthClass: WidthClass; short: boolean } {
  const { width, height } = useWindowDimensions();
  return { widthClass: widthClassFor(width), short: height < SHORT_MAX_HEIGHT };
}

function isLargeScreen(): boolean {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height) >= LARGE_SCREEN_MIN_SIDE;
}

/**
 * Whether the device's screen (not the window) is tablet-sized. This is what
 * decides orientation policy: iPadOS and Android 16+ ignore orientation locks
 * on large screens, so we never lock there. It flips when a foldable is
 * folded or unfolded.
 */
export function useIsLargeScreen(): boolean {
  const [large, setLarge] = useState(isLargeScreen);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setLarge(isLargeScreen()));
    return () => sub.remove();
  }, []);
  return large;
}
