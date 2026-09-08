import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkStringify from 'remark-stringify';
import type { JSONContent } from '@tiptap/core';
import { mdastToTiptap } from './mdast-to-tiptap';
import { tiptapToMdast } from './tiptap-to-mdast';

/**
 * Parse a Markdown string into a TipTap-compatible JSONContent document.
 * Combines mdast parsing (GFM + math support) and the mdast → TipTap bridge.
 * On parser failure we fall back to a single code block holding the raw
 * text so the editor never blanks out on malformed input.
 */
export function parseMarkdown(text: string): JSONContent {
  try {
    const mdast = unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(text);
    return mdastToTiptap(mdast);
  } catch (e) {
    return {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: null },
          content: [{ type: 'text', text }],
        },
      ],
    };
  }
}

/**
 * Serialize a TipTap JSONContent document back into a Markdown string.
 * Combines the TipTap → mdast bridge and mdast stringification (GFM + math,
 * `-` bullets, tight lists) so that round-tripped output is stable for the
 * supported Markdown subset.
 */
export function serializeMarkdown(doc: JSONContent): string {
  const mdast = tiptapToMdast(doc);
  return unified()
    .use(remarkStringify, { bullet: '-', spread: false, rule: '-' } as any)
    .use(remarkGfm)
    .use(remarkMath)
    .stringify(mdast);
}

export { mdastToTiptap, tiptapToMdast };
