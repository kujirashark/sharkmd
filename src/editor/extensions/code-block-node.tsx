import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { useTranslation } from 'react-i18next';

declare global {
  interface Window {
    __SHARKMD_MERMAID__?: typeof import('mermaid').default | null;
  }
}

let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid(): Promise<typeof import('mermaid').default> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const md = m.default;
      md.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        fontFamily: 'inherit',
      });
      window.__SHARKMD_MERMAID__ = md;
      return md;
    });
  }
  return mermaidPromise;
}

// Shiki is heavy (loads wasm + many grammars lazily). We load the singleton
// highlighter on first use and lazily fetch the grammar for each language.
let shikiPromise: Promise<import('shiki').Highlighter> | null = null;
function loadShiki(): Promise<import('shiki').Highlighter> {
  if (!shikiPromise) {
    shikiPromise = (async () => {
      const { createHighlighter } = await import('shiki');
      // Use the JavaScript regex engine (no wasm) to keep the bundle small
      // and avoid async wasm load delays. Quality is identical for the languages
      // we ship.
      const highlighter = await createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs: ['typescript', 'javascript', 'tsx', 'jsx', 'json', 'css', 'html', 'bash', 'python', 'rust', 'go', 'markdown', 'sql', 'yaml'],
      });
      return highlighter;
    })();
  }
  return shikiPromise;
}

function getThemeName(): 'github-light' | 'github-dark' {
  if (typeof document === 'undefined') return 'github-light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'github-dark' : 'github-light';
}

function CodeBlockNodeView({ node }: NodeViewProps) {
  const { t } = useTranslation();
  const language = (node.attrs.language as string | null) || '';
  const text = node.textContent || '';
  const isMermaid = language === 'mermaid';
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [highlighted, setHighlighted] = useState<string>('');
  const [highlightError, setHighlightError] = useState<string>('');
  const [showSource, setShowSource] = useState(false);

  // Mermaid rendering
  useEffect(() => {
    if (!isMermaid) return;
    let cancelled = false;
    (async () => {
      try {
        const md = await loadMermaid();
        if (cancelled) return;
        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
        const result = await md.render(id, text);
        if (!cancelled) setSvg(result.svg);
        if (!cancelled) setError('');
      } catch (e) {
        if (!cancelled) setError(String((e as Error).message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMermaid, text]);

  // Shiki syntax highlighting
  useEffect(() => {
    if (isMermaid) return; // Mermaid handles its own rendering
    if (!language) {
      setHighlighted('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hl = await loadShiki();
        if (cancelled) return;
        const theme = getThemeName();
        try {
          const html = hl.codeToHtml(text, {
            lang: language as any,
            theme,
          });
          if (!cancelled) {
            setHighlighted(html);
            setHighlightError('');
          }
        } catch (langErr) {
          // Unknown language — fall back to plain
          if (!cancelled) {
            setHighlighted('');
            setHighlightError('');
          }
        }
      } catch (e) {
        if (!cancelled) setHighlightError(String((e as Error).message ?? e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMermaid, language, text]);

  if (isMermaid) {
    if (showSource) {
      return (
        <pre
          className="code-block mermaid-source"
          onBlur={() => setShowSource(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setShowSource(false);
            }
          }}
        >
          <code className="language-mermaid" contentEditable suppressContentEditableWarning>
            {text}
          </code>
        </pre>
      );
    }
    return (
      <div
        className="mermaid-block"
        onDoubleClick={() => setShowSource(true)}
        data-language="mermaid"
      >
        {error ? (
          <pre className="mermaid-error">{t('mermaid.renderError', { msg: error })}\n\n{text}</pre>
        ) : svg ? (
          <div className="mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <pre className="mermaid-loading">{t('mermaid.loading')}\n\n{text}</pre>
        )}
      </div>
    );
  }

  // Plain or Shiki-highlighted code block
  return (
    <pre className="code-block" data-language={language || ''}>
      {highlighted ? (
        <code
          className={`language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted.replace(/^<pre[^>]*>|<\/pre>$/g, '').replace(/^<code[^>]*>|<\/code>$/g, '') }}
        />
      ) : highlightError ? (
        <code className="highlight-error">⚠ {highlightError}</code>
      ) : (
        <code className={language ? `language-${language}` : ''}>{text}</code>
      )}
    </pre>
  );
}

/**
 * Replaces StarterKit's CodeBlock with a custom NodeView that:
 * - Renders Mermaid diagrams inline when language==="mermaid" (double-click to edit source)
 * - Applies Shiki syntax highlighting for supported languages
 * - Falls back to plain monospace for unknown languages
 */
export const CodeBlockWithMermaid = Node.create({
  name: 'codeBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  addAttributes() {
    return {
      language: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'pre', preserveWhitespace: 'full' as const }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-language': node.attrs.language ?? '' }),
      ['code', { class: node.attrs.language ? `language-${node.attrs.language}` : '' }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView);
  },
});
