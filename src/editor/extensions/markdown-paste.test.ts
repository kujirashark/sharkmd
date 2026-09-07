import { describe, it, expect } from 'vitest';
import { detectMarkdown } from './markdown-paste';

describe('detectMarkdown', () => {
  it('detects headings/lists/code as markdown', () => {
    expect(detectMarkdown('# h')).toBe(true);
    expect(detectMarkdown('- a')).toBe(true);
    expect(detectMarkdown('```ts\nx')).toBe(true);
  });
  it('returns false for plain prose', () => {
    expect(detectMarkdown('hello world')).toBe(false);
    expect(detectMarkdown('Just a sentence.')).toBe(false);
  });
});
