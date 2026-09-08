import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createHighlighter, type Highlighter } from 'shiki';
import type { JSONContent } from '@tiptap/core';

let highlighterPromise: Promise<Highlighter> | null = null;
function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['typescript', 'javascript', 'tsx', 'jsx', 'json', 'css', 'html', 'bash', 'python', 'rust', 'go', 'markdown', 'sql', 'yaml'],
    });
  }
  return highlighterPromise;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderInline(node: JSONContent): string {
  if (node.type === 'text') {
    let html = escapeHtml(node.text ?? '');
    const marks = node.marks ?? [];
    // Apply marks outside-in
    for (const m of marks) {
      if (m.type === 'bold') html = `<strong>${html}</strong>`;
      else if (m.type === 'italic') html = `<em>${html}</em>`;
      else if (m.type === 'strike') html = `<s>${html}</s>`;
      else if (m.type === 'code') html = `<code>${html}</code>`;
      else if (m.type === 'link') {
        const href = (m.attrs as any)?.href ?? '#';
        const title = (m.attrs as any)?.title as string | null;
        html = `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${html}</a>`;
      }
    }
    return html;
  }
  if (node.type === 'hardBreak') return '<br/>';
  if (node.type === 'mathInline') {
    const latex = (node.attrs as any)?.latex ?? '';
    try {
      return katex.renderToString(latex, { throwOnError: false, output: 'html' });
    } catch (e) {
      return `<code class="math-error">${escapeHtml(latex)}</code>`;
    }
  }
  if (node.type === 'image') {
    const src = (node.attrs as any)?.src ?? '';
    const alt = (node.attrs as any)?.alt ?? '';
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"/>`;
  }
  return '';
}

function getText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.text) return node.text;
  return (node.content ?? []).map(getText).join('');
}

async function renderCodeBlock(text: string, language: string | null, theme: 'github-light' | 'github-dark'): Promise<string> {
  if (!language || language === 'mermaid') {
    return `<pre><code class="language-${escapeHtml(language ?? '')}">${escapeHtml(text)}</code></pre>`;
  }
  try {
    const hl = await getHighlighter();
    return hl.codeToHtml(text, { lang: language as any, theme });
  } catch {
    return `<pre><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre>`;
  }
}

async function renderBlock(node: JSONContent, theme: 'github-light' | 'github-dark'): Promise<string> {
  switch (node.type) {
    case 'paragraph': {
      const content = (node.content ?? []).map((c) => renderInline(c)).join('');
      return `<p>${content || '<br/>'}</p>`;
    }
    case 'heading': {
      const level = (node.attrs as any)?.level ?? 1;
      const content = (node.content ?? []).map((c) => renderInline(c)).join('');
      return `<h${level}>${content}</h${level}>`;
    }
    case 'blockquote': {
      const inner = await Promise.all((node.content ?? []).map((c) => renderBlock(c, theme)));
      return `<blockquote>${inner.join('')}</blockquote>`;
    }
    case 'codeBlock': {
      const language = (node.attrs as any)?.language ?? null;
      const text = getText(node);
      // For mermaid in exported HTML, include the raw text in a <pre> with class
      // so users can render it client-side (no mermaid runtime in pure HTML).
      if (language === 'mermaid') {
        return `<pre class="mermaid">${escapeHtml(text)}</pre>`;
      }
      return await renderCodeBlock(text, language, theme);
    }
    case 'bulletList':
    case 'orderedList': {
      const tag = node.type === 'bulletList' ? 'ul' : 'ol';
      const items = await Promise.all(
        (node.content ?? []).map(async (li) => {
          if (li.type === 'taskItem') {
            const checked = (li.attrs as any)?.checked ? 'checked' : '';
            const inner = await Promise.all((li.content ?? []).map((c) => renderBlock(c, theme)));
            return `<li><input type="checkbox" disabled ${checked}/> ${inner.join('')}</li>`;
          }
          const inner = await Promise.all((li.content ?? []).map((c) => renderBlock(c, theme)));
          return `<li>${inner.join('')}</li>`;
        })
      );
      return `<${tag}>${items.join('')}</${tag}>`;
    }
    case 'horizontalRule':
      return '<hr/>';
    case 'image': {
      const src = (node.attrs as any)?.src ?? '';
      const alt = (node.attrs as any)?.alt ?? '';
      return `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"/></p>`;
    }
    case 'mathDisplay': {
      const latex = (node.attrs as any)?.latex ?? '';
      try {
        return `<div class="math-display">${katex.renderToString(latex, { displayMode: true, throwOnError: false, output: 'html' })}</div>`;
      } catch (e) {
        return `<pre class="math-error">${escapeHtml(latex)}</pre>`;
      }
    }
    case 'table': {
      const rows = await Promise.all(
        (node.content ?? []).map(async (row) => {
          if (row.type !== 'tableRow') return '';
          const cells = await Promise.all(
            (row.content ?? []).map(async (cell) => {
              const inner = await Promise.all((cell.content ?? []).map((c) => renderBlock(c, theme)));
              return `<td>${inner.join('')}</td>`;
            })
          );
          return `<tr>${cells.join('')}</tr>`;
        })
      );
      return `<table>${rows.join('')}</table>`;
    }
    case 'taskList': {
      // Already handled in orderedList/bulletList above for taskItem.
      return '';
    }
    default:
      return '';
  }
}

export interface ExportOptions {
  title: string;
  author?: string;
  theme?: 'github-light' | 'github-dark';
}

/**
 * Convert a TipTap JSONContent document to a full standalone HTML string.
 * Includes KaTeX CSS + Shiki inline styles so the file renders identically
 * to the editor when opened in a browser.
 */
export async function exportToHTML(doc: JSONContent, opts: ExportOptions): Promise<string> {
  const theme = opts.theme ?? 'github-light';
  const body = (await Promise.all(
    (doc.content ?? []).map((c) => renderBlock(c, theme))
  )).join('\n');
  const date = new Date().toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(opts.title)}</title>
<style>
:root { color-scheme: ${theme === 'github-dark' ? 'dark' : 'light'}; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.6; max-width: 820px; margin: 40px auto; padding: 0 20px; color: ${theme === 'github-dark' ? '#e5e7eb' : '#1a1a1a'}; background: ${theme === 'github-dark' ? '#1a1a1a' : '#fff'}; }
h1, h2, h3, h4 { line-height: 1.25; margin-top: 1.6em; }
h1 { font-size: 1.9em; border-bottom: 1px solid ${theme === 'github-dark' ? '#374151' : '#e5e7eb'}; padding-bottom: .3em; }
h2 { font-size: 1.45em; border-bottom: 1px solid ${theme === 'github-dark' ? '#374151' : '#e5e7eb'}; padding-bottom: .2em; }
code { font-family: "JetBrains Mono", Consolas, Menlo, monospace; background: ${theme === 'github-dark' ? '#2a2a2a' : '#f3f4f6'}; padding: 1px 5px; border-radius: 3px; font-size: 90%; }
pre { background: ${theme === 'github-dark' ? '#0d1117' : '#f6f8fa'}; padding: 12px; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; font-size: 13px; }
blockquote { border-left: 4px solid ${theme === 'github-dark' ? '#4b5563' : '#d1d5db'}; padding-left: 1em; color: ${theme === 'github-dark' ? '#9ca3af' : '#6b7280'}; margin: 1em 0; }
table { border-collapse: collapse; margin: 1em 0; }
th, td { border: 1px solid ${theme === 'github-dark' ? '#374151' : '#d1d5db'}; padding: 6px 12px; }
hr { border: none; border-top: 1px solid ${theme === 'github-dark' ? '#374151' : '#e5e7eb'}; margin: 2em 0; }
.math-display { text-align: center; margin: 1em 0; }
img { max-width: 100%; }
.meta { color: ${theme === 'github-dark' ? '#9ca3af' : '#6b7280'}; font-size: 13px; border-bottom: 1px solid ${theme === 'github-dark' ? '#374151' : '#e5e7eb'}; padding-bottom: 1em; margin-bottom: 2em; }
input[type="checkbox"] { margin-right: 6px; }
</style>
</head>
<body>
<div class="meta">${escapeHtml(opts.author ?? 'sharkmd')} · ${date}</div>
${body}
</body>
</html>`;
}

/**
 * Trigger the browser print dialog. The user can pick "Save as PDF" in the
 * destination dropdown to produce a PDF. This is the lightest possible
 * PDF path (no extra deps); the HTML rendered is the same as exportToHTML().
 */
export async function exportToPDF(doc: JSONContent, opts: ExportOptions): Promise<void> {
  const html = await exportToHTML(doc, opts);
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    throw new Error('无法打开打印窗口（请允许弹窗）');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Wait a tick for the document to render before printing.
  setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}
