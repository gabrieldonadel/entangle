/**
 * Lightweight GFM-ish markdown parser for Cursor chat bubbles.
 * Covers headings, paragraphs, bold/italic/code/links, lists, fences, tables, hr.
 */

export type MdInline =
  | { type: 'text'; value: string }
  | { type: 'bold'; children: MdInline[] }
  | { type: 'italic'; children: MdInline[] }
  | { type: 'code'; value: string }
  | { type: 'link'; href: string; children: MdInline[] };

export type MdBlock =
  | { type: 'heading'; level: 1 | 2 | 3; children: MdInline[] }
  | { type: 'paragraph'; children: MdInline[] }
  | { type: 'code'; lang?: string; value: string }
  | { type: 'ul'; items: MdInline[][] }
  | { type: 'ol'; items: MdInline[][] }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'blockquote'; children: MdInline[] };

export function parseMarkdown(source: string): MdBlock[] {
  const text = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, value: body.join('\n') });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (heading) {
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        level,
        children: parseInline(heading[2]),
      });
      i += 1;
      continue;
    }

    if (isTableHeaderRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableHeaderRow(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', children: parseInline(quoted.join(' ')) });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: MdInline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
      !(isTableHeaderRow(lines[i]) && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
  }

  return blocks;
}

export function parseInline(input: string): MdInline[] {
  const nodes: MdInline[] = [];
  let i = 0;
  let buf = '';

  const flush = () => {
    if (!buf) return;
    nodes.push({ type: 'text', value: buf });
    buf = '';
  };

  while (i < input.length) {
    // inline code
    if (input[i] === '`') {
      const end = input.indexOf('`', i + 1);
      if (end > i) {
        flush();
        nodes.push({ type: 'code', value: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // links [text](url)
    if (input[i] === '[') {
      const close = input.indexOf(']', i + 1);
      if (close > i && input[close + 1] === '(') {
        const hrefEnd = input.indexOf(')', close + 2);
        if (hrefEnd > close) {
          flush();
          nodes.push({
            type: 'link',
            href: input.slice(close + 2, hrefEnd),
            children: parseInline(input.slice(i + 1, close)),
          });
          i = hrefEnd + 1;
          continue;
        }
      }
    }

    // bold ** or __
    if (
      (input[i] === '*' && input[i + 1] === '*') ||
      (input[i] === '_' && input[i + 1] === '_')
    ) {
      const marker = input.slice(i, i + 2);
      const end = input.indexOf(marker, i + 2);
      if (end > i) {
        flush();
        nodes.push({
          type: 'bold',
          children: parseInline(input.slice(i + 2, end)),
        });
        i = end + 2;
        continue;
      }
    }

    // italic * or _
    if (input[i] === '*' || input[i] === '_') {
      const marker = input[i];
      const end = input.indexOf(marker, i + 1);
      if (end > i) {
        flush();
        nodes.push({
          type: 'italic',
          children: parseInline(input.slice(i + 1, end)),
        });
        i = end + 1;
        continue;
      }
    }

    buf += input[i];
    i += 1;
  }

  flush();
  return nodes;
}

function isTableHeaderRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.includes('|', 1);
}

function isTableSep(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return false;
  const cells = splitTableRow(t);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

function splitTableRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return t.split('|').map((c) => c.trim());
}
