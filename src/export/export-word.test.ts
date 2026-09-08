import { describe, it, expect } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { exportToWord } from './export-html';

describe('exportToWord (Word HTML)', () => {
  it('renders a taskItem with checked checkbox inside bulletList', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [
          { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }] },
          { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }] },
        ],
      }],
    };
    const html = exportToWord(doc, { title: 't' });
    expect(html).toContain('<input type="checkbox" disabled checked');
    expect(html).toContain('<input type="checkbox" disabled ');
    expect(html).toContain('done');
    expect(html).toContain('todo');
  });

  it('renders inline math via KaTeX', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'E=' },
          { type: 'mathInline', attrs: { latex: 'mc^2' } },
        ],
      }],
    };
    const html = exportToWord(doc, { title: 't' });
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('$mc^2$');
  });

  it('renders display math as a centered div', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'mathDisplay', attrs: { latex: '\\sum_{i=1}^n i' } }],
    };
    const html = exportToWord(doc, { title: 't' });
    expect(html).toContain('class="math-display"');
    expect(html).toContain('class="katex"');
  });

  it('renders a 2x2 table with proper table/row/cell structure', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
              { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
              { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }] },
            ],
          },
        ],
      }],
    };
    const html = exportToWord(doc, { title: 't' });
    expect(html).toContain('<table>');
    expect(html).toContain('<tr>');
    expect(html).toContain('<th><p>A</p></th>');
    expect(html).toContain('<th><p>B</p></th>');
    expect(html).toContain('<td><p>1</p></td>');
    expect(html).toContain('<td><p>2</p></td>');
  });

  it('emits valid MSO HTML envelope (xml decl + Word.Document PI + namespaces)', () => {
    const doc: JSONContent = { type: 'doc', content: [] };
    const html = exportToWord(doc, { title: 'x' });
    expect(html.startsWith('<?xml version="1.0"')).toBe(true);
    expect(html).toContain('mso-application progid="Word.Document"');
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
    expect(html).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
  });
});
