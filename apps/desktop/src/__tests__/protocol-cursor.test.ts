import { decode, encode, PROTOCOL_VERSION } from '@entangle/protocol';
import type {
  CursorAccountMessage,
  CursorAgentsMessage,
  CursorCancelMessage,
  CursorDeltaMessage,
  CursorGetMessage,
  CursorListMessage,
  CursorModelsMessage,
  CursorModelsRequestMessage,
  CursorNewMessage,
  CursorOpenMessage,
  CursorPromptMessage,
  CursorResumeMessage,
  CursorSetModelMessage,
  CursorSnapshotMessage,
  CursorStatusMessage,
  CursorUsageMessage,
  CursorUsageRequestMessage,
} from '@entangle/protocol';

describe('cursor messages', () => {
  it('round-trips cursor.prompt', () => {
    const msg: CursorPromptMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.prompt',
      text: 'Fix the test',
      agentId: 'abc',
    };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips cursor.cancel / resume / get / new', () => {
    const cancel: CursorCancelMessage = { v: PROTOCOL_VERSION, t: 'cursor.cancel' };
    const resume: CursorResumeMessage = { v: PROTOCOL_VERSION, t: 'cursor.resume' };
    const get: CursorGetMessage = { v: PROTOCOL_VERSION, t: 'cursor.get' };
    const neu: CursorNewMessage = { v: PROTOCOL_VERSION, t: 'cursor.new' };
    expect(decode(encode(cancel))).toEqual(cancel);
    expect(decode(encode(resume))).toEqual(resume);
    expect(decode(encode(get))).toEqual(get);
    expect(decode(encode(neu))).toEqual(neu);
  });

  it('round-trips cursor.models request/response', () => {
    const req: CursorModelsRequestMessage = { v: PROTOCOL_VERSION, t: 'cursor.models' };
    const res: CursorModelsMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.models',
      models: [
        {
          id: 'default',
          displayName: 'Default',
          params: [
            {
              id: 'effort',
              displayName: 'Effort',
              values: [{ id: 'high', label: 'High' }],
            },
          ],
        },
      ],
    };
    expect(decode(encode(req))).toEqual(req);
    expect(decode(encode(res))).toEqual(res);
  });

  it('round-trips cursor.setModel / open / list / usage / me', () => {
    const setModel: CursorSetModelMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.setModel',
      modelId: 'default',
      params: [{ id: 'effort', value: 'high' }],
    };
    const open: CursorOpenMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.open',
      agentId: 'agent-1',
    };
    const list: CursorListMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.list',
      limit: 20,
    };
    const usageReq: CursorUsageRequestMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.usage',
      agentId: 'agent-1',
    };
    const me = { v: PROTOCOL_VERSION, t: 'cursor.me' as const };
    expect(decode(encode(setModel))).toEqual(setModel);
    expect(decode(encode(open))).toEqual(open);
    expect(decode(encode(list))).toEqual(list);
    expect(decode(encode(usageReq))).toEqual(usageReq);
    expect(decode(encode(me))).toEqual(me);
  });

  it('round-trips cursor.status with usage', () => {
    const msg: CursorStatusMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.status',
      status: 'finished',
      agentId: 'a1',
      runId: 'r1',
      cwd: '/tmp/proj',
      model: 'default',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips cursor.delta thinking', () => {
    const msg: CursorDeltaMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.delta',
      kind: 'thinking',
      text: 'Hmm',
      agentId: 'a1',
      runId: 'r1',
    };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips cursor.delta shell', () => {
    const msg: CursorDeltaMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.delta',
      kind: 'shell',
      text: '$ ls\nfile.txt\nexit 0',
      agentId: 'a1',
      runId: 'r1',
    };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips cursor.snapshot with thinking', () => {
    const msg: CursorSnapshotMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.snapshot',
      status: 'idle',
      agentId: 'a1',
      transcript: [
        { role: 'user', text: 'hi' },
        { role: 'thinking', text: '…' },
        { role: 'assistant', text: 'hello' },
        { role: 'tool', text: 'Ran shell' },
        { role: 'result', text: 'Done.' },
      ],
    };
    expect(decode(encode(msg))).toEqual(msg);
  });

  it('round-trips cursor.agents / usage / account', () => {
    const agents: CursorAgentsMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.agents',
      items: [
        {
          agentId: 'a1',
          name: 'Chat',
          summary: 'hi',
          lastModified: 1,
          status: 'finished',
        },
      ],
      nextCursor: 'abc',
    };
    const usage: CursorUsageMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.usage',
      agentId: 'a1',
      usage: { totalTokens: 100 },
      costCents: 12,
      runs: [{ runId: 'u1', usage: { totalTokens: 50 } }],
    };
    const account: CursorAccountMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.account',
      apiKeyName: 'phone',
      userEmail: 'a@b.c',
      userId: 1,
    };
    expect(decode(encode(agents))).toEqual(agents);
    expect(decode(encode(usage))).toEqual(usage);
    expect(decode(encode(account))).toEqual(account);
  });

  it('round-trips cursor.workspaces request/response and setWorkspace', () => {
    const req = { v: PROTOCOL_VERSION, t: 'cursor.workspaces' as const };
    const set = {
      v: PROTOCOL_VERSION,
      t: 'cursor.setWorkspace' as const,
      path: '/Users/me/Partners.code-workspace',
    };
    const res = {
      v: PROTOCOL_VERSION,
      t: 'cursor.workspaces' as const,
      workspaces: [
        {
          path: '/Users/me/Partners.code-workspace',
          name: 'Partners',
          kind: 'code-workspace' as const,
        },
        { path: '/Users/me/entangle', name: 'entangle', kind: 'folder' as const },
      ],
      active: '/Users/me/Partners.code-workspace',
    };
    expect(decode(encode(req))).toEqual(req);
    expect(decode(encode(set))).toEqual(set);
    expect(decode(encode(res))).toEqual(res);
  });

  it('round-trips cursor.file get/list/files', () => {
    const getReq = {
      v: PROTOCOL_VERSION,
      t: 'cursor.file.get' as const,
      path: 'apps/mobile/src/app/cursor.tsx',
    };
    const listReq = {
      v: PROTOCOL_VERSION,
      t: 'cursor.file.list' as const,
      path: 'apps/mobile',
    };
    const fileRes = {
      v: PROTOCOL_VERSION,
      t: 'cursor.file' as const,
      path: 'apps/mobile/src/app/cursor.tsx',
      text: 'export default function CursorScreen() {}',
      truncated: false,
    };
    const listing = {
      v: PROTOCOL_VERSION,
      t: 'cursor.file.listing' as const,
      path: 'apps/mobile',
      entries: [
        { name: 'src', kind: 'dir' as const },
        { name: 'package.json', kind: 'file' as const, size: 100 },
      ],
    };
    const files = {
      v: PROTOCOL_VERSION,
      t: 'cursor.files' as const,
      files: [
        { path: 'apps/mobile/src/app/cursor.tsx', op: 'write' as const },
        { path: 'README.md', op: 'read' as const },
      ],
      agentId: 'a1',
    };
    expect(decode(encode(getReq))).toEqual(getReq);
    expect(decode(encode(listReq))).toEqual(listReq);
    expect(decode(encode(fileRes))).toEqual(fileRes);
    expect(decode(encode(listing))).toEqual(listing);
    expect(decode(encode(files))).toEqual(files);
  });

  it('round-trips cursor.diffs / keep / discard', () => {
    const diffs = {
      v: PROTOCOL_VERSION,
      t: 'cursor.diffs' as const,
      files: [
        {
          path: 'a.ts',
          diff: '--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n',
          linesAdded: 1,
          linesRemoved: 1,
        },
      ],
    };
    const keep = { v: PROTOCOL_VERSION, t: 'cursor.keep' as const };
    const discard = {
      v: PROTOCOL_VERSION,
      t: 'cursor.discard' as const,
      paths: ['a.ts'],
    };
    const req = { v: PROTOCOL_VERSION, t: 'cursor.diffs' as const };
    expect(decode(encode(diffs))).toEqual(diffs);
    expect(decode(encode(keep))).toEqual(keep);
    expect(decode(encode(discard))).toEqual(discard);
    expect(decode(encode(req))).toEqual(req);
  });

  it('rejects unknown cursor tags', () => {
    expect(
      decode(JSON.stringify({ v: PROTOCOL_VERSION, t: 'cursor.unknown' })),
    ).toBeNull();
  });

  it('round-trips cursor.usage with error and prompt images', () => {
    const usage: CursorUsageMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.usage',
      usage: { totalTokens: 0 },
      error: 'Billed usage is unavailable for this API key.',
    };
    const prompt: CursorPromptMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.prompt',
      text: 'Describe this',
      images: [{ data: 'abc', mimeType: 'image/png' }],
    };
    const list: CursorListMessage = {
      v: PROTOCOL_VERSION,
      t: 'cursor.list',
      limit: 40,
      cursor: 'page-2',
    };
    expect(decode(encode(usage))).toEqual(usage);
    expect(decode(encode(prompt))).toEqual(prompt);
    expect(decode(encode(list))).toEqual(list);
  });
});
