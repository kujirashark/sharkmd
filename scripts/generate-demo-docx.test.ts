/**
 * One-off script: generates docs/test-export.docx from docs/v0.2-demo.md
 * for manual Word 2016+ / WPS verification.
 *
 * Run: pnpm test --run scripts/generate-demo-docx.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { exportToDocx } from '../src/export/export-docx';
import { parseMarkdown } from '../src/editor/bridge';

describe('generate demo .docx for manual verification', () => {
  it('writes docs/test-export.docx from v0.2-demo.md', async () => {
    const mdPath = path.resolve(__dirname, '../docs/v0.2-demo.md');
    const outPath = path.resolve(__dirname, '../docs/test-export.docx');
    if (!fs.existsSync(mdPath)) {
      throw new Error(`Missing demo markdown at ${mdPath}`);
    }
    const md = fs.readFileSync(mdPath, 'utf-8');
    const json = parseMarkdown(md);
    const blob = await exportToDocx(json, { title: 'sharkmd v0.2 demo' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    fs.writeFileSync(outPath, bytes);
    const size = fs.statSync(outPath).size;
    expect(size).toBeGreaterThan(2000);
    console.log(`✓ Wrote ${outPath} (${size} bytes)`);
  });
});
