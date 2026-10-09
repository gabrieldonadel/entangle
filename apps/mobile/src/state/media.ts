import { create } from 'zustand';

import type { MediaStateMessage } from '@entangle/protocol';

interface MediaState {
  playing: boolean;
  title: string | null;
  artist: string | null;
  album: string | null;
  /** App the metadata came from, e.g. `Spotify`. */
  app: string | null;
  /** Base64 PNG of that app's icon. */
  iconPng: string | null;
  /** False until the Mac has told us what it is playing. */
  synced: boolean;
  applyRemote: (msg: MediaStateMessage) => void;
  /**
   * Flip the transport state locally the moment a button is pressed.
   *
   * The Mac corrects this on the next `state.media`, but only Music and
   * Spotify announce themselves — for a video in a browser tab nothing ever
   * comes back, and without this the play button would sit on the wrong icon
   * for as long as the track lasts.
   */
  setLocalPlaying: (playing: boolean) => void;
  reset: () => void;
}

const EMPTY = {
  playing: false,
  title: null,
  artist: null,
  album: null,
  app: null,
  iconPng: null,
  synced: false,
};

export const useMedia = create<MediaState>((set) => ({
  ...EMPTY,
  applyRemote: (msg) =>
    set({
      playing: msg.playing,
      title: msg.title ?? null,
      artist: msg.artist ?? null,
      album: msg.album ?? null,
      app: msg.app ?? null,
      iconPng: msg.iconPng ?? null,
      synced: true,
    }),
  setLocalPlaying: (playing) => set({ playing }),
  reset: () => set(EMPTY),
}));

/** Whether any player actually named what is playing. */
export function hasTrackInfo(state: {
  title: string | null;
  artist: string | null;
  album: string | null;
}): boolean {
  return state.title != null || state.artist != null || state.album != null;
}
