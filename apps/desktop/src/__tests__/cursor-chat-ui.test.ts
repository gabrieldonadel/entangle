import {
  collapseToolChips,
  parseToolLine,
  toDisplayRows,
} from '../../../mobile/src/features/cursor/chat-display';
import { parseInline, parseMarkdown } from '../../../mobile/src/features/cursor/markdown';

describe('cursor chat markdown', () => {
  it('parses headings, bold, and lists', () => {
    const blocks = parseMarkdown(
      '### Manual checks\n\n**Chat**\n\n1. Send a prompt\n2. Cancel mid-run\n\n- alpha\n- beta',
    );
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'paragraph',
      'ol',
      'ul',
    ]);
    const heading = blocks[0];
    expect(heading.type).toBe('heading');
    if (heading.type === 'heading') expect(heading.level).toBe(3);

    const boldPara = blocks[1];
    expect(boldPara.type).toBe('paragraph');
    if (boldPara.type === 'paragraph') {
      expect(boldPara.children.some((c) => c.type === 'bold')).toBe(true);
    }
  });

  it('parses fenced code and inline code', () => {
    const blocks = parseMarkdown('Use `agentId`.\n\n```sh\npnpm desktop test\n```');
    expect(blocks[0].type).toBe('paragraph');
    if (blocks[0].type === 'paragraph') {
      expect(blocks[0].children).toEqual(
        expect.arrayContaining([{ type: 'code', value: 'agentId' }]),
      );
    }
    expect(blocks[1]).toEqual({
      type: 'code',
      lang: 'sh',
      value: 'pnpm desktop test',
    });
  });

  it('parses GFM tables instead of leaving pipes raw', () => {
    const blocks = parseMarkdown(
      '| Gap | Meaning |\n| --- | --- |\n| No E2E | Only unit tests |\n| Dead copy | Not wired |',
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'table',
      headers: ['Gap', 'Meaning'],
      rows: [
        ['No E2E', 'Only unit tests'],
        ['Dead copy', 'Not wired'],
      ],
    });
  });

  it('parses nested inline markers', () => {
    expect(parseInline('see `copyTranscript` and **bold**')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'code', value: 'copyTranscript' },
      { type: 'text', value: ' and ' },
      { type: 'bold', children: [{ type: 'text', value: 'bold' }] },
    ]);
  });
});

describe('cursor chat tool display', () => {
  it('parses Running / Ran / failed lines', () => {
    expect(parseToolLine('Running task…')).toEqual({ name: 'task', state: 'running' });
    expect(parseToolLine('Ran task')).toEqual({ name: 'task', state: 'done' });
    expect(parseToolLine('shell failed')).toEqual({ name: 'shell', state: 'error' });
  });

  it('parses shell command detail after a colon', () => {
    expect(parseToolLine('Running shell: ls -la…')).toEqual({
      name: 'shell',
      detail: 'ls -la',
      state: 'running',
    });
    expect(parseToolLine('Ran edit: src/foo.ts')).toEqual({
      name: 'edit',
      detail: 'src/foo.ts',
      state: 'done',
    });
  });

  it('collapses Running→Ran for the same tool into one chip', () => {
    const chips = collapseToolChips([
      { id: '1', role: 'tool', text: 'Running task…' },
      { id: '2', role: 'tool', text: 'Running task…' },
      { id: '3', role: 'tool', text: 'Ran task' },
    ]);
    expect(chips).toEqual([
      { key: '3', name: 'task', state: 'done', label: 'Ran task' },
    ]);
  });

  it('groups consecutive tools in display rows', () => {
    const rows = toDisplayRows([
      { id: 'u', role: 'user', text: 'hi' },
      { id: 't1', role: 'tool', text: 'Running explore…' },
      { id: 't2', role: 'tool', text: 'Ran explore' },
      { id: 'a', role: 'assistant', text: '### Done' },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: 'single' });
    expect(rows[1]).toMatchObject({
      kind: 'tools',
      chips: [{ name: 'explore', state: 'done', label: 'Ran explore' }],
    });
    expect(rows[2]).toMatchObject({ kind: 'single' });
  });

  it('keeps shell blocks as their own rows', () => {
    const rows = toDisplayRows([
      { id: 't1', role: 'tool', text: 'Running shell: ls…' },
      { id: 's1', role: 'shell', text: '$ ls\nfile.txt\nexit 0' },
      { id: 't2', role: 'tool', text: 'Ran shell: ls' },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['tools', 'shell', 'tools']);
    expect(rows[1]).toMatchObject({
      kind: 'shell',
      item: { text: '$ ls\nfile.txt\nexit 0' },
    });
  });
});

describe('unified diff parse', () => {
  it('colors added and deleted lines', () => {
    const { parseUnifiedDiff } = require('../../../mobile/src/features/cursor/diff-parse');
    const rows = parseUnifiedDiff(
      '--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n',
    );
    expect(rows.map((r: { kind: string }) => r.kind)).toEqual([
      'meta',
      'meta',
      'hunk',
      'ctx',
      'del',
      'add',
    ]);
  });
});
