# sharkmd — 功能演示

> 一款对标 Typora 体验的本地 Markdown 编辑器。

## 核心特性

- **所见即所得** —— 键入即渲染，无预览/编辑双模式
- **即时格式化** —— `# 空格` 变标题，`**粗体**` 自动加粗
- **完整快捷键** —— Ctrl+B/I/K/S/Z/Y/F 全套
- **多标签页 + 文件树** —— 像 VSCode 一样管文件
- **自动保存** —— 300ms 防抖，崩溃恢复

## 格式示例

行内：*斜体*、**粗体**、~~删除线~~、`行内代码`、[链接](https://github.com/kujirashark/sharkmd)

代码块：

```typescript
function hello(name: string): string {
  return `Hello, ${name}!`;
}

console.log(hello('sharkmd'));
```

## 表格

| 功能 | MVP | 规划中 |
|------|:---:|:------:|
| 标题 / 段落 | ✅ | |
| 表格 | ✅ | |
| 图片粘贴 | ✅ | |
| KaTeX 公式 |   | 🔜 v0.2 |
| Mermaid 图表 |   | 🔜 v0.2 |

## 任务列表

- [x] MVP 完成
- [x] 推送到 GitHub
- [ ] 实现 PDF 导出
- [ ] 主题商店

## 引用

> 简单的事做到极致，就是不简单。
> —— sharkmd 设计原则

## 链接

- [GitHub 仓库](https://github.com/kujirashark/sharkmd)
- [Tauri](https://tauri.app)
- [TipTap](https://tiptap.dev)

---

按下 `Ctrl+F` 试试查找替换。点左侧 **大纲** 标签看本文档目录。
