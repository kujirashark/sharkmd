import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type Katex from 'katex';

/**
 * React component that renders a single math node (inline or display).
 * - When not focused, shows the rendered KaTeX output.
 * - When focused, shows a textarea so the user can edit the LaTeX source.
 * Toggling focus via double-click keeps editing cheap without dropping into raw source mode.
 *
 * KaTeX itself is loaded lazily (via dynamic import) so the initial bundle
 * stays small; while it loads we show the raw LaTeX so the document isn't empty.
 */
function MathNodeView({ node, updateAttributes, extension }: NodeViewProps) {
  const isDisplay = extension.name === 'mathDisplay';
  const latex = (node.attrs.latex as string) || '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(latex);
  const [katex, setKatex] = useState<typeof Katex | null>(null);
  useEffect(() => {
    let cancelled = false;
    import('katex').then((m) => {
      if (!cancelled) setKatex(() => m.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  let html: string;
  if (katex) {
    try {
      html = katex.renderToString(latex, { displayMode: isDisplay, throwOnError: false, output: 'html' });
    } catch (e) {
      html = `<span class="math-error">KaTeX error: ${String((e as Error).message ?? e)}</span>`;
    }
  } else {
    // Fall back to raw LaTeX while the bundle loads so the node is never blank.
    html = isDisplay
      ? `<pre class="math-loading">${latex.replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</pre>`
      : `<code class="math-loading">${latex.replace(/[<&>]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</code>`;
  }
  const className = isDisplay
    ? (editing ? 'math-display math-editing' : 'math-display')
    : (editing ? 'math-inline math-editing' : 'math-inline');
  // contentEditable={false} on the root: the math node is atom (non-editable).
  // Without it React's default makes the wrapper div a separate non-editable
  // subtree, which breaks the editor's contentEditable inheritance and
  // swallows Enter / arrow keys globally.
  if (editing) {
    return (
      <div className={className} contentEditable={false} data-latex={latex}>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            updateAttributes({ latex: draft });
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              updateAttributes({ latex: draft });
              setEditing(false);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(latex);
              setEditing(false);
            }
          }}
        />
      </div>
    );
  }
  return (
    <div
      className={className}
      contentEditable={false}
      onDoubleClick={() => {
        setDraft(latex);
        setEditing(true);
      }}
      data-latex={latex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const commonAttrs = { latex: { default: '' } };

/** Block-level math: `$$\n...\n$$` */
export const MathDisplay = Node.create({
  name: 'mathDisplay',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return commonAttrs;
  },
  parseHTML() {
    return [{ tag: 'div.math-display' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'math-display' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});

/** Inline math: `$...$` */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return commonAttrs;
  },
  parseHTML() {
    return [{ tag: 'span.math-inline' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'math-inline' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});
