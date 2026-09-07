import type {
  Root,
  RootContent,
  PhrasingContent,
  Heading,
  Paragraph,
  Text,
  Strong,
  Emphasis,
  Link,
  InlineCode,
  Blockquote,
  Code,
  List,
  ListItem,
  ThematicBreak,
  Break,
  Image,
  Table,
  TableRow,
  TableCell,
} from 'mdast';
import type { JSONContent } from '@tiptap/core';

type Marks = { type: string; attrs?: Record<string, unknown> }[];

function marksToArray(...ms: Marks[]): Marks {
  return ms.flat();
}

function convertText(node: Text, marks: Marks = []): JSONContent {
  return { type: 'text', text: node.value, marks: marks.length ? marks : undefined };
}

function convertInline(node: PhrasingContent, marks: Marks = []): JSONContent {
  switch (node.type) {
    case 'text':
      return convertText(node, marks);
    case 'strong':
      return convertInline(node.children[0] as PhrasingContent, marksToArray(marks, [{ type: 'bold' }]));
    case 'emphasis':
      return convertInline(node.children[0] as PhrasingContent, marksToArray(marks, [{ type: 'italic' }]));
    case 'delete':
      return convertInline(node.children[0] as PhrasingContent, marksToArray(marks, [{ type: 'strike' }]));
    case 'inlineCode':
      return { type: 'text', text: node.value, marks: marksToArray(marks, [{ type: 'code' }]) };
    case 'link':
      return convertInline(
        node.children[0] as PhrasingContent,
        marksToArray(marks, [{ type: 'link', attrs: { href: node.url, title: node.title ?? null } }])
      );
    case 'break':
      return { type: 'hardBreak' };
    case 'image':
      return { type: 'image', attrs: { src: node.url, alt: node.alt ?? null } };
    default:
      // Fallback: unrecognised inline degrades to empty text
      return { type: 'text', text: '' };
  }
}

function convertBlock(node: RootContent): JSONContent | JSONContent[] | null {
  switch (node.type) {
    case 'paragraph': {
      const para = node as Paragraph;
      return { type: 'paragraph', content: para.children.map((c) => convertInline(c)) };
    }
    case 'heading': {
      const h = node as Heading;
      return {
        type: 'heading',
        attrs: { level: Math.min(4, Math.max(1, h.depth)) },
        content: h.children.map((c) => convertInline(c)),
      };
    }
    case 'blockquote': {
      const bq = node as Blockquote;
      return {
        type: 'blockquote',
        content: bq.children.flatMap((c) => convertBlock(c) as JSONContent[]),
      };
    }
    case 'code': {
      const c = node as Code;
      return {
        type: 'codeBlock',
        attrs: { language: c.lang ?? null },
        content: c.value ? [{ type: 'text', text: c.value }] : [],
      };
    }
    case 'list': {
      const l = node as List;
      const type = l.ordered ? 'orderedList' : 'bulletList';
      const attrs = l.ordered ? { order: l.start ?? 1 } : undefined;
      return { type, attrs, content: l.children.map(convertListItem) };
    }
    case 'thematicBreak':
      return { type: 'horizontalRule' };
    case 'table': {
      const t = node as Table;
      return {
        type: 'table',
        content: t.children.map((r) => ({
          type: 'tableRow',
          content: (r as TableRow).children.map((c) => convertCell(c)),
        })),
      };
    }
    case 'html':
      return null; // MVP: ignore raw HTML
    default:
      return null;
  }
}

function convertListItem(li: ListItem): JSONContent {
  // listItem: first paragraph is the li body; subsequent blocks keep their order
  const blocks: JSONContent[] = [];
  for (const c of li.children) {
    const b = convertBlock(c);
    if (b) blocks.push(b as JSONContent);
  }
  return { type: 'listItem', content: blocks };
}

function convertCell(cell: TableCell): JSONContent {
  // MVP: table headers are inferred from the first row at convert time but
  // lost on round-trip — always emit tableCell here.
  const para: Paragraph = {
    type: 'paragraph',
    children: cell.children.length ? cell.children : [{ type: 'text', value: '' } as Text],
  } as any;
  return {
    type: 'tableCell',
    content: [convertBlock(para)!] as any,
  };
}

export function mdastToTiptap(root: Root): JSONContent {
  return {
    type: 'doc',
    content: root.children
      .map(convertBlock)
      .filter((x): x is JSONContent => x !== null)
      .flatMap((x) => (Array.isArray(x) ? x : [x])),
  };
}
