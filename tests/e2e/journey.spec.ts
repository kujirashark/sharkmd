import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const fixtureDir = join(tmpdir(), 'easymd-e2e');
mkdirSync(fixtureDir, { recursive: true });
const mdPath = join(fixtureDir, 'hello.md');
writeFileSync(mdPath, '# Hello\n\nWorld **bold**.\n');

test('user opens .md file, types, sees inline formatting', async ({ page }) => {
  await page.goto('/');
  await page.click('text=选择目录');
  await page.fill('input[placeholder="工作目录"]', fixtureDir);
  await page.click('text=选择目录'); // confirm
  // Since MVP uses window.prompt, the prompt dialog itself cannot be
  // automated reliably from a plain browser. Use the in-page test hook
  // exposed only in dev mode to inject the file directly.
  await page.evaluate(async (p) => {
    // @ts-ignore hook exposed in dev only
    await window.__easymd_open?.(p);
  }, mdPath);
  await expect(page.locator('h1')).toContainText('Hello');
  // Type "## Test" to verify the markdown input rule promotes it to H2.
  await page.locator('.ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('## Test');
  await expect(page.locator('h2')).toContainText('Test');
});