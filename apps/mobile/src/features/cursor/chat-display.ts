/** Minimal shape — avoids coupling display helpers to the Zustand store. */
export type ChatDisplayItem = {
  id: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool' | 'shell' | 'result';
  text: string;
};

export type ToolChip = {
  key: string;
  name: string;
  state: 'running' | 'done' | 'error' | 'result';
  label: string;
  detail?: string;
};

export type DisplayRow =
  | { kind: 'single'; item: ChatDisplayItem }
  | { kind: 'shell'; item: ChatDisplayItem }
  | { kind: 'tools'; id: string; chips: ToolChip[] };

/** Collapse consecutive tool/result rows into labeled chips; keep shell blocks. */
export function toDisplayRows(items: ChatDisplayItem[]): DisplayRow[] {
  const rows: DisplayRow[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.role === 'shell') {
      rows.push({ kind: 'shell', item });
      i += 1;
    } else if (item.role === 'tool' || item.role === 'result') {
      const group: ChatDisplayItem[] = [];
      while (i < items.length && (items[i].role === 'tool' || items[i].role === 'result')) {
        group.push(items[i]);
        i += 1;
      }
      rows.push({
        kind: 'tools',
        id: group[0].id,
        chips: collapseToolChips(group),
      });
    } else {
      rows.push({ kind: 'single', item });
      i += 1;
    }
  }
  return rows;
}

export function collapseToolChips(items: ChatDisplayItem[]): ToolChip[] {
  const order: string[] = [];
  const byKey = new Map<string, ToolChip>();

  for (const item of items) {
    if (item.role === 'result') {
      const name = 'result';
      if (!byKey.has(name)) order.push(name);
      byKey.set(name, {
        key: item.id,
        name,
        state: 'result',
        label: truncate(item.text, 72) || 'Result',
      });
      continue;
    }

    const parsed = parseToolLine(item.text);
    // Keep shell/edit invocations distinct when detail differs.
    const mapKey = parsed.detail ? `${parsed.name}:${parsed.detail}` : parsed.name;
    if (!byKey.has(mapKey)) order.push(mapKey);
    byKey.set(mapKey, {
      key: item.id,
      name: parsed.name,
      state: parsed.state,
      detail: parsed.detail,
      label: chipLabel(parsed),
    });
  }

  return order.map((n) => byKey.get(n)!);
}

export function parseToolLine(text: string): {
  name: string;
  state: 'running' | 'done' | 'error';
  detail?: string;
} {
  const raw = text.trim();
  const running = raw.match(/^Running\s+(.+?)(?:…|\.\.\.)?\s*$/i);
  if (running) {
    return { ...splitNameDetail(running[1]), state: 'running' };
  }
  const failed = raw.match(/^(.+?)\s+failed\s*$/i);
  if (failed) {
    return { ...splitNameDetail(failed[1]), state: 'error' };
  }
  const ran = raw.match(/^Ran\s+(.+?)\s*$/i);
  if (ran) {
    return { ...splitNameDetail(ran[1]), state: 'done' };
  }
  return { ...splitNameDetail(raw), state: 'done' };
}

function splitNameDetail(raw: string): { name: string; detail?: string } {
  const cleaned = cleanName(raw);
  const colon = cleaned.indexOf(':');
  if (colon > 0) {
    return {
      name: cleaned.slice(0, colon).trim() || 'tool',
      detail: cleaned.slice(colon + 1).trim() || undefined,
    };
  }
  return { name: cleaned || 'tool' };
}

function chipLabel(parsed: {
  name: string;
  state: 'running' | 'done' | 'error';
  detail?: string;
}): string {
  const body = parsed.detail ? `${parsed.name}: ${parsed.detail}` : parsed.name;
  const clipped = truncate(body, 80);
  switch (parsed.state) {
    case 'running':
      return `Running ${clipped}…`;
    case 'error':
      return `${clipped} failed`;
    default:
      return `Ran ${clipped}`;
  }
}

function cleanName(name: string): string {
  return name.replace(/[….]+$/g, '').trim();
}

function truncate(s: string, n: number): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}
