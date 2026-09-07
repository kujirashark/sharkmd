import type { JSONContent } from '@tiptap/core';
import type { Root, RootContent, PhrasingContent, BlockContent, Table } from 'mdast';

function inlineMarks(node: JSONContent): { type: string; attrs?: Record<string, unknown> }[] {
  return node.marks ?? [];
}

function convertInline(node: JSONContent): PhrasingContent[] {
  if (node.type === 'text') {
    const marks = inlineMarks(node);
    if (!marks.length) return [{ type: 'text', value: node.text ?? '' }];
    // 从内到外包装
    let inner: PhrasingContent = { type: 'text', value: node.text ?? '' };
    for (const m of marks) {
      if (m.type === 'bold') inner = { type: 'strong', children: [inner] } as any;
      else if (m.type === 'italic') inner = { type: 'emphasis', children: [inner] } as any;
      else if (m.type === 'strike') inner = { type: 'delete', children: [inner] } as any;
      else if (m.type === 'code') inner = { type: 'inlineCode', value: (inner as any).value ?? '' } as any;
      else if (m.type === 'link') inner = { type: 'link', url: m.attrs!.href as string, title: (m.attrs!.title as string | null) ?? null, children: [inner] } as any;
    }
    return [inner];
  }
  if (node.type === 'hardBreak') return [{ type: 'break' }];
  if (node.type === 'image') return [{ type: 'image', url: node.attrs!.src as string, alt: (node.attrs!.alt as string | null) ?? null }];
  return [];
}

function convertBlock(node: JSONContent): RootContent[] {
  switch (node.type) {
    case 'paragraph':
      return [{ type: 'paragraph', children: (node.content ?? []).flatMap(convertInline) } as any];
    case 'heading':
      return [{ type: 'heading', depth: node.attrs!.level as number, children: (node.content ?? []).flatMap(convertInline) } as any];
    case 'blockquote':
      return [{ type: 'blockquote', children: (node.content ?? []).flatMap((c) => convertBlock(c)) as BlockContent[] } as any];
    case 'codeBlock': {
      const text = (node.content ?? []).map((c) => (c.type === 'text' ? c.text ?? '' : '')).join('');
      return [{ type: 'code', lang: (node.attrs!.language as string | null) ?? null, value: text } as any];
    }
    case 'bulletList':
    case 'orderedList': {
      const items = (node.content ?? []).map((li) => ({
        type: 'listItem',
        // TipTap doesn't carry the loose/tight distinction; default to tight for round-trip consistency
        spread: false,
        children: (li.content ?? []).flatMap((c) => convertBlock(c)) as BlockContent[],
      })) as any;
      return [{
        type: 'list',
        ordered: node.type === 'orderedList',
        start: node.type === 'orderedList' ? (node.attrs?.order as number | undefined) : undefined,
        spread: false,
        children: items,
      } as any];
    }
    case 'horizontalRule':
      return [{ type: 'thematicBreak' } as any];
    case 'image':
      return [{ type: 'image', url: node.attrs!.src as string, alt: (node.attrs!.alt as string | null) ?? null } as any];
    case 'table': {
      const rows = (node.content ?? []).filter((c) => c.type === 'tableRow');
      const table: Table = { type: 'table', children: rows.map((row) => ({
        type: 'tableRow',
        children: (row.content ?? []).map((cell) => ({
          type: 'tableCell',
          children: (cell.content ?? []).flatMap((c) => convertBlock(c)) as BlockContent[],
        })),
      })) as any };
      return [table as any];
    }
    default:
      return [];
  }
}

export function tiptapToMdast(doc: JSONContent): Root {
  return {
    type: 'root',
    children: (doc.content ?? []).flatMap(convertBlock) as BlockContent[],
  } as Root;
}