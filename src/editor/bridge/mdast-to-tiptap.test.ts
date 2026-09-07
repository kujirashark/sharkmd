import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mdastToTiptap } from './mdast-to-tiptap';

function parse(md: string) {
  return unified().use(remarkParse).use(remarkGfm).parse(md);
}

describe('mdastToTiptap - basic', () => {
  it('converts heading + paragraph + bold + link', () => {
    const json = mdastToTiptap(parse('# Title\n\nHello **world** with [link](https://x.com).\n'));
    expect(json.type).toBe('doc');
    expect(json.content![0]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
    const p = json.content![1];
    expect(p.type).toBe('paragraph');
    // children: text "Hello ", text "world" w/ bold, text " with ", text "link" w/ link
    const inline = p.content!;
    expect(inline[0]).toMatchObject({ type: 'text', text: 'Hello ' });
    expect(inline[1]).toMatchObject({ type: 'text', text: 'world', marks: [{ type: 'bold' }] });
    expect(inline[3]).toMatchObject({
      type: 'text',
      text: 'link',
      marks: [{ type: 'link', attrs: { href: 'https://x.com' } }],
    });
  });

  it('converts nested list preserving indent', () => {
    const json = mdastToTiptap(parse('- a\n- b\n  - c\n'));
    const ul = json.content![0];
    expect(ul.type).toBe('bulletList');
    expect(ul.content).toHaveLength(2);
    // 简化为：第二个 li 的第二个子节点是嵌套 bulletList
    expect(ul.content![1].content![1].type).toBe('bulletList');
    expect(ul.content![1].content![1].content![0].type).toBe('listItem');
  });

  it('converts code block with language', () => {
    const json = mdastToTiptap(parse('```ts\nconst x = 1;\n```\n'));
    expect(json.content![0]).toMatchObject({ type: 'codeBlock', attrs: { language: 'ts' } });
  });

  it('converts gfm table', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |\n';
    const json = mdastToTiptap(parse(md));
    expect(json.content![0].type).toBe('table');
    expect(json.content![0].content).toHaveLength(2); // header row + body row
  });

  it('round-trips fixture file', () => {
    const md = readFileSync(join(__dirname, '__fixtures__/basic.md'), 'utf-8');
    const json = mdastToTiptap(parse(md));
    expect(json.type).toBe('doc');
    expect(json.content).toBeDefined();
  });
});
