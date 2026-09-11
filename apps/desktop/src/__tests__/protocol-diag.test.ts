import { decode, encode, isDiagState, isUdpOk, PROTOCOL_VERSION } from '@entangle/protocol';
import type {
  UdpOkMessage,
  WelcomeMessage,
  DiagReportMessage,
  DiagSetMessage,
  DiagStateMessage,
  PointerMoveMessage,
} from '@entangle/protocol';

const SNAPSHOT: DiagStateMessage = {
  v: PROTOCOL_VERSION,
  t: 'state.diag',
  rate: 118,
  gapP50: 8.3,
  gapP95: 17.1,
  jitter: 2.4,
  procP50: 0.21,
  procP95: 0.9,
  stalls: 1,
};

describe('diagnostics messages', () => {
  it('round-trips diag.set', () => {
    const msg: DiagSetMessage = { v: PROTOCOL_VERSION, t: 'diag.set', on: true };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips a state.diag snapshot', () => {
    const decoded = decode(encode(SNAPSHOT));
    expect(decoded).not.toBeNull();
    expect(isDiagState(decoded!)).toBe(true);
    expect(decoded).toEqual(SNAPSHOT);
  });

  it('round-trips the phone\'s own report', () => {
    const report: DiagReportMessage = {
      v: PROTOCOL_VERSION,
      t: 'diag.report',
      sendRate: 117,
      touchRate: 119,
      uiThread: true,
      highRefresh: true,
      rttP50: 11,
      rttP95: 23,
    };
    expect(decode(encode(report))).toEqual(report);
  });

  it('carries the log path when the Mac has one', () => {
    const withPath: DiagStateMessage = {
      ...SNAPSHOT,
      logPath: '/Users/someone/Library/Logs/Entangle/pointer-diag.jsonl',
    };
    const decoded = decode(encode(withPath));
    expect(decoded).toEqual(withPath);
    // And stays absent when it is not set, rather than becoming null.
    expect(decode(encode(SNAPSHOT))).not.toHaveProperty('logPath');
  });

  it('does not mistake another push for a diag snapshot', () => {
    const display = decode(
      encode({ v: PROTOCOL_VERSION, t: 'state.display', asleep: false }),
    );
    expect(display).not.toBeNull();
    expect(isDiagState(display!)).toBe(false);
  });

  it('carries a pointer move with and without a timestamp', () => {
    const plain: PointerMoveMessage = {
      v: PROTOCOL_VERSION,
      t: 'p.move',
      dx: 1.5,
      dy: -2.25,
      seq: 9,
    };
    expect(decode(encode(plain))).toEqual(plain);

    const stamped: PointerMoveMessage = { ...plain, ts: 1234.5 };
    expect(decode(encode(stamped))).toEqual(stamped);
  });
});

describe('udp handshake messages', () => {
  it('round-trips a welcome carrying the datagram offer', () => {
    const welcome: WelcomeMessage = {
      v: PROTOCOL_VERSION,
      t: 'welcome',
      server: { name: 'Mac', version: '0.0.1', host: 'Mac' },
      caps: ['pointer', 'udp'],
      udp: { port: 49827, token: 'abc123' },
    };
    expect(decode(encode(welcome))).toEqual(welcome);
  });

  it('round-trips a udp.ok, and recognises it', () => {
    const ok: UdpOkMessage = { v: PROTOCOL_VERSION, t: 'udp.ok', frames: 57 };
    const decoded = decode(encode(ok));
    expect(decoded).not.toBeNull();
    expect(isUdpOk(decoded!)).toBe(true);
    expect(decoded).toEqual(ok);
  });

  it('does not mistake another push for a udp.ok', () => {
    const other = decode(encode({ v: PROTOCOL_VERSION, t: 'state.display', asleep: true }));
    expect(isUdpOk(other!)).toBe(false);
  });
});
