import { describe, it, expect } from 'vitest';
import { parseMarkdown, serializeMarkdown } from './index';

const samples = [
  '# Title\n\nHello.',
  '**b** *i* ~~s~~ `c` [l](u).',
  '- a\n- b\n  - c\n',
  '1. one\n2. two\n',
  '```ts\nconst x = 1;\n```\n',
  '| a | b |\n| - | - |\n| 1 | 2 |\n',
  '> quote\n',
  '---',
  'text with ![img](a.png)\n',
  // GFM task list (阶段 0)
  '- [ ] todo\n- [x] done\n',
  '- [x] **bold** task\n  - [ ] nested\n',
  // KaTeX math (阶段 1)
  'inline $E=mc^2$ math.\n',
  '$$\n\\int_0^1 x\\,dx\n$$\n',
];

describe('bridge roundtrip', () => {
  for (const md of samples) {
    it(`preserves ${md.slice(0, 30)}`, () => {
      const json = parseMarkdown(md);
      const back = serializeMarkdown(json);
      expect(back.trim()).toBe(md.trim());
    });
  }
});
