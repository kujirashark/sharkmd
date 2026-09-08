import { useState, useEffect } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/core';

export interface ToolbarProps {
  editor: TiptapEditor | null;
}

interface ButtonDef {
  key: string;
  label: string;
  title: string;
  isActive?: (e: TiptapEditor) => boolean;
  run: (e: TiptapEditor) => void;
}

const buttons: (ButtonDef | 'sep')[] = [
  {
    key: 'h1', label: 'H1', title: '一级标题（行首 # 空格）',
    isActive: (e) => e.isActive('heading', { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2', label: 'H2', title: '二级标题（行首 ## 空格）',
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3', label: 'H3', title: '三级标题（行首 ### 空格）',
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  'sep',
  {
    key: 'b', label: 'B', title: '加粗（Ctrl+B，**text**）',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: 'i', label: 'I', title: '斜体（Ctrl+I，*text*）',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: 's', label: 'S', title: '删除线（~~text~~）',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    key: 'code', label: '</>', title: '行内代码（`code`）',
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  'sep',
  {
    key: 'ul', label: '• 列表', title: '无序列表（行首 - 空格）',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'ol', label: '1. 列表', title: '有序列表（行首 1. 空格）',
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'quote', label: '" 引用', title: '引用（行首 > 空格）',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  'sep',
  {
    key: 'link', label: '🔗', title: '插入链接（Ctrl+K，格式：[文本](URL)）',
    isActive: (e) => e.isActive('link'),
    run: (e) => {
      const href = window.prompt('链接 URL');
      if (!href) return;
      e.chain().focus().toggleLink({ href }).run();
    },
  },
  {
    key: 'hr', label: '— 分割', title: '分割线（行首 ---）',
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  'sep',
  {
    key: 'table', label: '⊞ 表格', title: '插入 3×3 表格（含表头）',
    // Explicit focus() before insertTable — when the toolbar button receives
    // focus, the editor loses its selection; without this first call the
    // table lands at doc start and can clobber content.
    run: (e) => {
      e.commands.focus();
      e.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    key: 'codeblock', label: '``` 代码', title: '代码块（行首 ```）',
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: 'image', label: '🖼 图片', title: '插入图片（输入 URL 或粘贴/拖拽）',
    run: (e) => {
      const url = window.prompt('图片 URL（粘贴地址，或直接拖拽图片到编辑器）');
      if (!url) return;
      e.chain().focus().setImage({ src: url, alt: '' }).run();
    },
  },
];

export function Toolbar({ editor }: ToolbarProps) {
  // Force re-render on selection change so isActive() reflects current state
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!editor) return <div className="toolbar" />;

  return (
    <div className="toolbar" role="toolbar" aria-label="格式工具栏">
      {buttons.map((b, i) => {
        if (b === 'sep') return <span key={`sep-${i}`} className="sep" />;
        const active = b.isActive?.(editor) ?? false;
        return (
          <button
            key={b.key}
            type="button"
            title={b.title}
            data-active={active}
            onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
            onClick={() => b.run(editor)}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
