import { describe, it, expect } from 'vitest';
import { mdastToTiptap } from './mdast-to-tiptap';
import { tiptapToMdast } from './tiptap-to-mdast';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';

function parse(md: string) { return unified().use(remarkParse).use(remarkGfm).parse(md); }
function stringify(root: any) {
  return unified().use(remarkStringify, { bullet: '-' }).use(remarkGfm).stringify(root);
}

describe('tiptapToMdast', () => {
  it('heading round-trips', () => {
    const md = '# H1\n\n## H2\n';
    const tt = mdastToTiptap(parse(md));
    const back = tiptapToMdast(tt);
    expect(stringify(back).trim()).toBe(md.trim());
  });

  it('bold/italic/link round-trips', () => {
    const md = 'Hello **b** *i* [l](u).\n';
    const tt = mdastToTiptap(parse(md));
    const back = tiptapToMdast(tt);
    expect(stringify(back).trim()).toBe(md.trim());
  });

  it('nested list round-trips', () => {
    const md = '- a\n- b\n  - c\n';
    const tt = mdastToTiptap(parse(md));
    const back = tiptapToMdast(tt);
    expect(stringify(back).trim()).toBe(md.trim());
  });

  it('code block with language round-trips', () => {
    const md = '```ts\nconst x = 1;\n```\n';
    const tt = mdastToTiptap(parse(md));
    const back = tiptapToMdast(tt);
    expect(stringify(back).trim()).toBe(md.trim());
  });
});