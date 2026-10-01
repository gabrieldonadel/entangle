export type DiffLine = {
  key: string;
  kind: 'add' | 'del' | 'ctx' | 'meta' | 'hunk';
  text: string;
};

/** Parse a unified diff into colored line rows. */
export function parseUnifiedDiff(diff: string): DiffLine[] {
  const rows: DiffLine[] = [];
  const lines = diff.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, i) => {
    if (!line && i === lines.length - 1) return;
    let kind: DiffLine['kind'] = 'ctx';
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ')) {
      kind = 'meta';
    } else if (line.startsWith('@@')) {
      kind = 'hunk';
    } else if (line.startsWith('+')) {
      kind = 'add';
    } else if (line.startsWith('-')) {
      kind = 'del';
    }
    rows.push({ key: `${i}:${kind}`, kind, text: line });
  });
  return rows;
}
