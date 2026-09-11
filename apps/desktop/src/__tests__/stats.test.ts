import { foldMessageStats } from '../stats';
import type { ClientInfo, StatsInput } from '../stats';

const NOW = 1_700_000_010_000;
const STARTED_AT = NOW - 5_000;

function client(overrides: Partial<ClientInfo> = {}): ClientInfo {
  return {
    id: 'a',
    host: '192.168.1.5:51000',
    connectedAt: STARTED_AT,
    lastMessageAt: STARTED_AT,
    messageCount: 0,
    messageRate: 0,
    ...overrides,
  };
}

function input(overrides: Partial<StatsInput> = {}): StatsInput {
  return {
    clients: { a: client() },
    rateHistory: [0, 0, 0, 0],
    startedAt: STARTED_AT,
    ...overrides,
  };
}

describe('foldMessageStats', () => {
  it('applies the per-client count as the rate and adds it to the total', () => {
    const next = foldMessageStats(input(), { clients: [{ id: 'a', count: 61 }], total: 61 }, NOW);
    expect(next.clients.a.messageRate).toBe(61);
    expect(next.clients.a.messageCount).toBe(61);
    expect(next.clients.a.lastMessageAt).toBe(NOW);
    expect(next.messageRate).toBe(61);
  });

  it('accumulates counts across ticks', () => {
    const first = foldMessageStats(input(), { clients: [{ id: 'a', count: 60 }], total: 60 }, NOW);
    const second = foldMessageStats(
      { ...input(), clients: first.clients },
      { clients: [{ id: 'a', count: 40 }], total: 40 },
      NOW + 1000,
    );
    expect(second.clients.a.messageCount).toBe(100);
    expect(second.clients.a.messageRate).toBe(40);
  });

  it('decays a silent client to zero without touching its last-seen time', () => {
    const busy = foldMessageStats(input(), { clients: [{ id: 'a', count: 60 }], total: 60 }, NOW);
    const quiet = foldMessageStats(
      { ...input(), clients: busy.clients },
      { clients: [], total: 0 },
      NOW + 1000,
    );
    expect(quiet.clients.a.messageRate).toBe(0);
    expect(quiet.clients.a.messageCount).toBe(60);
    expect(quiet.clients.a.lastMessageAt).toBe(NOW);
  });

  it('ignores counts for clients that have already disconnected', () => {
    const next = foldMessageStats(
      { ...input(), clients: {} },
      { clients: [{ id: 'gone', count: 12 }], total: 12 },
      NOW,
    );
    expect(next.clients).toEqual({});
    expect(next.messageRate).toBe(12);
  });

  it('shifts the sparkline by one sample per tick', () => {
    const next = foldMessageStats(input(), { clients: [], total: 7 }, NOW);
    expect(next.rateHistory).toEqual([0, 0, 0, 7]);
    expect(next.rateHistory).toHaveLength(4);
  });

  it('reports uptime from the start time', () => {
    const next = foldMessageStats(input(), { clients: [], total: 0 }, NOW);
    expect(next.uptimeSeconds).toBe(5);
  });

  it('reports zero uptime before the server has started', () => {
    const next = foldMessageStats(
      { ...input(), startedAt: null },
      { clients: [], total: 0 },
      NOW,
    );
    expect(next.uptimeSeconds).toBe(0);
  });
});
