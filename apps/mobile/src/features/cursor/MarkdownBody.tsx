import { Fragment, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import {
  parseMarkdown,
  type MdBlock,
  type MdInline,
} from './markdown';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

type Props = {
  text: string;
};

export function MarkdownBody({ text }: Props) {
  const blocks = parseMarkdown(text);
  if (!blocks.length) {
    return <Text style={styles.p}>{text}</Text>;
  }
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block, i)}</Fragment>
      ))}
    </View>
  );
}

function renderBlock(block: MdBlock, index: number): ReactNode {
  switch (block.type) {
    case 'heading': {
      const style =
        block.level === 1
          ? styles.h1
          : block.level === 2
            ? styles.h2
            : styles.h3;
      return (
        <Text style={[style, index > 0 && styles.blockGap]}>
          {renderInlines(block.children)}
        </Text>
      );
    }
    case 'paragraph':
      return (
        <Text style={[styles.p, index > 0 && styles.blockGap]}>
          {renderInlines(block.children)}
        </Text>
      );
    case 'blockquote':
      return (
        <View style={[styles.quote, index > 0 && styles.blockGap]}>
          <Text style={styles.quoteText}>{renderInlines(block.children)}</Text>
        </View>
      );
    case 'code':
      return (
        <View style={[styles.codeBlock, index > 0 && styles.blockGap]}>
          <Text style={styles.codeBlockText} selectable>
            {block.value}
          </Text>
        </View>
      );
    case 'ul':
      return (
        <View style={[styles.list, index > 0 && styles.blockGap]}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{renderInlines(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'ol':
      return (
        <View style={[styles.list, index > 0 && styles.blockGap]}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listRow}>
              <Text style={styles.bullet}>{j + 1}.</Text>
              <Text style={styles.listText}>{renderInlines(item)}</Text>
            </View>
          ))}
        </View>
      );
    case 'table':
      return (
        <View style={[styles.table, index > 0 && styles.blockGap]}>
          <View style={[styles.tableRow, styles.tableHead]}>
            {block.headers.map((h, j) => (
              <Text key={j} style={[styles.tableCell, styles.tableHeadCell]}>
                {h}
              </Text>
            ))}
          </View>
          {block.rows.map((row, r) => (
            <View key={r} style={styles.tableRow}>
              {row.map((cell, c) => (
                <Text key={c} style={styles.tableCell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'hr':
      return <View style={[styles.hr, index > 0 && styles.blockGap]} />;
    default:
      return null;
  }
}

function renderInlines(nodes: MdInline[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={i}>{node.value}</Fragment>;
      case 'bold':
        return (
          <Text key={i} style={styles.bold}>
            {renderInlines(node.children)}
          </Text>
        );
      case 'italic':
        return (
          <Text key={i} style={styles.italic}>
            {renderInlines(node.children)}
          </Text>
        );
      case 'code':
        return (
          <Text key={i} style={styles.inlineCode}>
            {node.value}
          </Text>
        );
      case 'link':
        return (
          <Text key={i} style={styles.link}>
            {renderInlines(node.children)}
          </Text>
        );
      default:
        return null;
    }
  });
}

const styles = StyleSheet.create({
  root: { gap: 0 },
  blockGap: { marginTop: 12 },
  p: { color: '#fff', fontSize: 15, lineHeight: 22 },
  h1: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  h2: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  h3: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  bold: { fontWeight: '700', color: '#fff' },
  italic: { fontStyle: 'italic', color: '#fff' },
  link: { color: '#64d2ff', textDecorationLine: 'underline' },
  inlineCode: {
    fontFamily: MONO,
    fontSize: 13,
    color: '#ffd60a',
    backgroundColor: '#2c2c2e',
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  codeBlock: {
    backgroundColor: '#141416',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2c2e',
  },
  codeBlockText: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
    color: '#e5e5ea',
  },
  list: { gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: {
    color: '#8e8e93',
    fontSize: 15,
    lineHeight: 22,
    minWidth: 18,
  },
  listText: { flex: 1, color: '#fff', fontSize: 15, lineHeight: 22 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: '#3a3a3c',
    paddingLeft: 10,
  },
  quoteText: { color: '#aeaeb2', fontSize: 15, lineHeight: 22 },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3c',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  tableHead: { backgroundColor: '#1c1c1e' },
  tableCell: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tableHeadCell: { fontWeight: '700', color: '#aeaeb2' },
  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#3a3a3c',
    marginVertical: 4,
  },
});
