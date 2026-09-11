import { create } from 'zustand';
import { summarize } from '@entangle/protocol';

import { syncPointerConfig } from '@/features/trackpad/uplink';
import type { DiagStateMessage } from '@entangle/protocol';

/**
 * Pointer-path diagnostics. Off by default.
 *
 * Split in two on purpose: the phone can only honestly measure what it does
 * itself (how often it sends, and the round trip), and the Mac reports what
 * happens on its side. Nothing here tries to compare the two clocks.
 */

/**
 * Checked when a round trip lands, so it is a plain ref rather than a store
 * read. The pointer path has its own copy as a shared value, because it runs
 * on the UI thread where this one is not visible.
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

export type Transport = 'off' | 'probing' | 'active';

interface DiagState {
  enabled: boolean;
  /**
   * Run pointer movement on the UI thread. On by default; the switch exists
   * so a bad interaction can be turned off without a new build, and so the
   * two paths can be compared inside one session.
   */
  uiThreadPointer: boolean;
  setUiThreadPointer: (enabled: boolean) => void;
  /**
   * Hold the display at its maximum refresh rate while a finger is down.
   * iOS delivers touches in step with the screen, and a static screen lets
   * ProMotion idle at 60 Hz.
   */
  highRefresh: boolean;
  setHighRefresh: (enabled: boolean) => void;
  /** Which wire pointer frames are currently taking. */
  transport: Transport;
  /** Raw gesture callbacks in the last second, before coalescing. */
  touchRate: number;
  /** Where the Mac is writing the log, once it has told us. */
  logPath: string | null;
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

/** Round trips since the last tick. */
let rttSamples: number[] = [];

export const useDiag = create<DiagState>((set) => ({
  enabled: false,
  uiThreadPointer: true,
  setUiThreadPointer: (enabled) => set({ uiThreadPointer: enabled }),
  highRefresh: true,
  setHighRefresh: (enabled) => set({ highRefresh: enabled }),
  transport: 'off',
  logPath: null,
  touchRate: 0,
  sendRate: 0,
  rttP50: 0,
  rttP95: 0,
  mac: null,
  setEnabled: (enabled) => {
    diagEnabledRef.current = enabled;
    syncPointerConfig({ diagEnabled: enabled });
    rttSamples = [];
    set({
      enabled,
      sendRate: 0,
      touchRate: 0,
      rttP50: 0,
      rttP95: 0,
      mac: null,
      logPath: null,
    });
  },
  applyRemote: (msg) =>
    set((state) => ({
      logPath: msg.logPath ?? state.logPath,
      mac: {
        rate: msg.rate,
        gapP50: msg.gapP50,
        gapP95: msg.gapP95,
        jitter: msg.jitter,
        procP50: msg.procP50,
        procP95: msg.procP95,
        stalls: msg.stalls,
      },
    })),
  reset: () => {
    diagEnabledRef.current = false;
    syncPointerConfig({ diagEnabled: false });
    rttSamples = [];
    set({
      enabled: false,
      sendRate: 0,
      touchRate: 0,
      rttP50: 0,
      rttP95: 0,
      mac: null,
      logPath: null,
    });
  },
}));

export function recordRtt(ms: number) {
  if (!diagEnabledRef.current) return;
  rttSamples.push(ms);
}

export interface PhoneStats {
  sendRate: number;
  touchRate: number;
  rttP50: number;
  rttP95: number;
  uiThread: boolean;
  highRefresh: boolean;
}

/**
 * Rolls one second of phone-side counters into the store and returns them, so
 * the caller can put the same figures on the wire for the Mac's log.
 *
 * The connection owns the timer rather than this module, so the displayed
 * numbers and the reported ones are always the same second — and so this
 * store never has to import the socket.
 */
export function tickPhoneStats(counters: {
  touches: number;
  sends: number;
}): PhoneStats {
  const sendRate = counters.sends;
  const touchRate = counters.touches;
  const samples = rttSamples;
  rttSamples = [];
  const { p50, p95 } = summarize(samples);
  const state = useDiag.getState();
  // Keep the last reading when a second passes with no round trip, rather
  // than blinking to zero between pings.
  const rttP50 = samples.length > 0 ? p50 : state.rttP50;
  const rttP95 = samples.length > 0 ? p95 : state.rttP95;
  useDiag.setState({ sendRate, touchRate, rttP50, rttP95 });
  return {
    sendRate,
    touchRate,
    rttP50,
    rttP95,
    uiThread: state.uiThreadPointer,
    highRefresh: state.highRefresh,
  };
}
