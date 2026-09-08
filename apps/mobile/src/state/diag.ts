import { create } from 'zustand';
import { summarize } from '@entangle/protocol';
import type { DiagStateMessage } from '@entangle/protocol';

/**
 * Pointer-path diagnostics. Off by default.
 *
 * Split in two on purpose: the phone can only honestly measure what it does
 * itself (how often it sends, and the round trip), and the Mac reports what
 * happens on its side. Nothing here tries to compare the two clocks.
 */

/**
 * Read on every pointer flush, so it is a plain ref rather than a store read.
 * Mirrors the pattern in `settings.ts`.
 */
export const diagEnabledRef = { current: false };

export interface MacDiag {
  rate: number;
  gapP50: number;
  gapP95: number;
  jitter: number;
  procP50: number;
  procP95: number;
  stalls: number;
}

interface DiagState {
  enabled: boolean;
  /** Pointer messages the phone put on the wire in the last second. */
  sendRate: number;
  /** Round trip measured by the phone, milliseconds. */
  rttP50: number;
  rttP95: number;
  /** Last snapshot from the Mac, or null until one arrives. */
  mac: MacDiag | null;
  setEnabled: (enabled: boolean) => void;
  applyRemote: (msg: DiagStateMessage) => void;
  reset: () => void;
}

/** Sends since the last tick. A plain counter: no re-render per frame. */
let sentSinceTick = 0;
/** Round trips since the last tick. */
let rttSamples: number[] = [];
let tickTimer: ReturnType<typeof setInterval> | null = null;

export const useDiag = create<DiagState>((set) => ({
  enabled: false,
  sendRate: 0,
  rttP50: 0,
  rttP95: 0,
  mac: null,
  setEnabled: (enabled) => {
    diagEnabledRef.current = enabled;
    sentSinceTick = 0;
    rttSamples = [];
    stopTicking();
    if (enabled) startTicking();
    set({ enabled, sendRate: 0, rttP50: 0, rttP95: 0, mac: null });
  },
  applyRemote: (msg) =>
    set({
      mac: {
        rate: msg.rate,
        gapP50: msg.gapP50,
        gapP95: msg.gapP95,
        jitter: msg.jitter,
        procP50: msg.procP50,
        procP95: msg.procP95,
        stalls: msg.stalls,
      },
    }),
  reset: () => {
    diagEnabledRef.current = false;
    sentSinceTick = 0;
    rttSamples = [];
    stopTicking();
    set({ enabled: false, sendRate: 0, rttP50: 0, rttP95: 0, mac: null });
  },
}));

/** Called from the pointer flush. Deliberately does not touch the store. */
export function recordSend() {
  if (!diagEnabledRef.current) return;
  sentSinceTick += 1;
}

export function recordRtt(ms: number) {
  if (!diagEnabledRef.current) return;
  rttSamples.push(ms);
}

function startTicking() {
  tickTimer = setInterval(() => {
    const rate = sentSinceTick;
    const samples = rttSamples;
    sentSinceTick = 0;
    rttSamples = [];
    // Keep the last reading when a second passes with no round trip, rather
    // than blinking to zero between pings.
    const { p50, p95 } = summarize(samples);
    useDiag.setState((state) => ({
      sendRate: rate,
      rttP50: samples.length > 0 ? p50 : state.rttP50,
      rttP95: samples.length > 0 ? p95 : state.rttP95,
    }));
  }, 1000);
}

function stopTicking() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
