import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { JSONContent } from '@tiptap/core';
import { exportToDocx } from './export-docx';

async function unpack(blob: Blob): Promise<Record<string, string>> {
  const buf = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const out: Record<string, string> = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir) out[name] = await entry.async('string');
  }
  return out;
}

describe('exportToDocx (real OOXML)', () => {
  it('produces a valid .docx zip with required parts', async () => {
    const doc: JSONContent = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello sharkmd' }] },
    ] };
    const blob = await exportToDocx(doc, { title: 't' });
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(500);

    const files = await unpack(blob);
    // Required OOXML parts.
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['word/document.xml']).toBeDefined();
    expect(files['word/_rels/document.xml.rels']).toBeDefined();
    // Verify zip magic bytes (PK\x03\x04).
    const head = new Uint8Array(await blob.arrayBuffer()).slice(0, 4);
    expect(head[0]).toBe(0x50); // P
    expect(head[1]).toBe(0x4b); // K
    expect(head[2]).toBe(0x03);
    expect(head[3]).toBe(0x04);
  });

  it('renders headings, bold, italic, strike, code marks into w:p / w:r', async () => {
    const doc: JSONContent = { type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] },
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
      { type: 'paragraph', content: [
        { type: 'text', text: 'plain ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'strike', marks: [{ type: 'strike' }] },
        { type: 'text', text: ' ' },
        { type: 'text', text: 'code', marks: [{ type: 'code' }] },
      ] },
    ] };
    const blob = await exportToDocx(doc, { title: 't' });
    const files = await unpack(blob);
    const xml = files['word/document.xml'];
    expect(xml).toContain('Title');
    expect(xml).toContain('Subtitle');
    expect(xml).toContain('<w:b/>');   // bold
    expect(xml).toContain('<w:i/>');   // italic
    expect(xml).toContain('<w:strike'); // strike
  });

  it('renders taskItem checkboxes using Unicode ☑/☐', async () => {
    const doc: JSONContent = { type: 'doc', content: [{
      type: 'taskList', content: [
        { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'done' }] }] },
        { type: 'taskItem', attrs: { checked: false }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'todo' }] }] },
      ],
    }] };
    const blob = await exportToDocx(doc, { title: 't' });
    const files = await unpack(blob);
    const xml = files['word/document.xml'];
    expect(xml).toContain('☑'); // checked
    expect(xml).toContain('☐'); // unchecked
    expect(xml).toContain('done');
    expect(xml).toContain('todo');
  });

  it('renders a table with header row and cell text', async () => {
    const doc: JSONContent = { type: 'doc', content: [{
      type: 'table', content: [
        { type: 'tableRow', content: [
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col A' }] }] },
          { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col B' }] }] },
        ] },
        { type: 'tableRow', content: [
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a1' }] }] },
          { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b1' }] }] },
        ] },
      ],
    }] };
    const blob = await exportToDocx(doc, { title: 't' });
    const files = await unpack(blob);
    const xml = files['word/document.xml'];
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('Col A');
    expect(xml).toContain('Col B');
    expect(xml).toContain('a1');
    expect(xml).toContain('b1');
  });

  it('falls back math nodes to LaTeX source text', async () => {
    const doc: JSONContent = { type: 'doc', content: [
      { type: 'paragraph', content: [
        { type: 'text', text: 'Energy ' },
        { type: 'mathInline', attrs: { latex: 'E=mc^2' } },
        { type: 'text', text: '.' },
      ] },
      { type: 'mathDisplay', attrs: { latex: '\\int_0^1 x\\,dx' } },
    ] };
    const blob = await exportToDocx(doc, { title: 't' });
    const files = await unpack(blob);
    const xml = files['word/document.xml'];
    expect(xml).toContain('$E=mc^2$');
    expect(xml).toContain('$\\int_0^1 x\\,dx$');
  });

  it('marks mermaid code blocks as a fallback notice', async () => {
    const doc: JSONContent = { type: 'doc', content: [{
      type: 'codeBlock', attrs: { language: 'mermaid' }, content: [
        { type: 'text', text: 'graph TD\n  A-->B' },
      ],
    }] };
    const blob = await exportToDocx(doc, { title: 't' });
    const files = await unpack(blob);
    const xml = files['word/document.xml'];
    expect(xml).toContain('[Mermaid');
    expect(xml).toContain('graph TD');
  });

  it('renders an empty doc without errors', async () => {
    const doc: JSONContent = { type: 'doc', content: [] };
    const blob = await exportToDocx(doc, { title: 'empty' });
    expect(blob.size).toBeGreaterThan(300);
    const files = await unpack(blob);
    expect(files['word/document.xml']).toBeDefined();
  });
});
