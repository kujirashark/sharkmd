import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { nodes } from './nodes';
import { marks } from './marks';

const schema = new Schema({ nodes, marks });

describe('schema', () => {
  it('creates heading with level', () => {
    const h1 = schema.nodes.heading.create({ level: 1 }, schema.text('hi'));
    expect(h1.type.name).toBe('heading');
    expect(h1.attrs.level).toBe(1);
  });

  it('creates code block with language', () => {
    const cb = schema.nodes.codeBlock.create({ language: 'ts' });
    expect(cb.attrs.language).toBe('ts');
  });

  it('image has src and alt', () => {
    const img = schema.nodes.image.create({ src: 'a.png', alt: 'A' });
    expect(img.attrs.src).toBe('a.png');
    expect(img.attrs.alt).toBe('A');
  });

  it('link mark has href', () => {
    const m = schema.marks.link.create({ href: 'https://x' });
    expect(m.attrs.href).toBe('https://x');
  });
});
