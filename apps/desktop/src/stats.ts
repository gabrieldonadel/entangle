import type { MessageStatsEvent } from 'entangle-server';

export type ClientInfo = {
  id: string;
  host: string;
  connectedAt: number;
  lastMessageAt: number;
  messageCount: number;
  messageRate: number;
};

export interface StatsInput {
  clients: Record<string, ClientInfo>;
  rateHistory: number[];
  startedAt: number | null;
}

export interface StatsPatch {
  clients: Record<string, ClientInfo>;
  rateHistory: number[];
  messageRate: number;
  uptimeSeconds: number;
}

/**
 * Folds one second of native counters into store shape.
 *
 * The native module owns the counting. Pointer moves are handled in Swift and
 * deliberately never reach JavaScript, so this runs once a second rather than
 * once per cursor sample — see `EntangleServerModule.startStatsTimer`.
 *
 * Kept apart from the store so it can be tested without the native module.
 */
export function foldMessageStats(
  state: StatsInput,
  event: MessageStatsEvent,
  now: number,
): StatsPatch {
  const counts = new Map(event.clients.map((client) => [client.id, client.count]));
  const clients: Record<string, ClientInfo> = {};
  for (const [id, client] of Object.entries(state.clients)) {
    const count = counts.get(id) ?? 0;
    clients[id] = {
      ...client,
      messageRate: count,
      messageCount: client.messageCount + count,
      // A silent second must not look like fresh activity.
      lastMessageAt: count > 0 ? now : client.lastMessageAt,
    };
  }
  return {
    clients,
    rateHistory: [...state.rateHistory.slice(1), event.total],
    messageRate: event.total,
    uptimeSeconds: state.startedAt ? Math.floor((now - state.startedAt) / 1000) : 0,
  };
}
