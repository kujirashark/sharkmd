import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { JSONContent } from '@tiptap/core';
import { mdastToTiptap } from './mdast-to-tiptap';
import { tiptapToMdast } from './tiptap-to-mdast';

/**
 * Parse a Markdown string into a TipTap-compatible JSONContent document.
 * Combines mdast parsing (with GFM support) and the mdast → TipTap bridge.
 */
export function parseMarkdown(text: string): JSONContent {
  const mdast = unified().use(remarkParse).use(remarkGfm).parse(text);
  return mdastToTiptap(mdast);
}

/**
 * Serialize a TipTap JSONContent document back into a Markdown string.
 * Combines the TipTap → mdast bridge and mdast stringification (with GFM
 * support, `-` bullets, and tight lists) so that round-tripped output is
 * stable for the supported Markdown subset.
 */
export function serializeMarkdown(doc: JSONContent): string {
  const mdast = tiptapToMdast(doc);
  return unified()
    .use(remarkStringify, { bullet: '-', spread: false, rule: '-' } as any)
    .use(remarkGfm)
    .stringify(mdast);
}

export { mdastToTiptap, tiptapToMdast };
