# sharkmd

> 一款对标 Typora 体验的本地 Markdown 编辑器。基于 Tauri 2 + React 18 + TipTap 2 + unified/remark，所见即所得，本地优先，支持 Windows（macOS/Linux 代码兼容）。

![status](https://img.shields.io/badge/status-MVP-blue) ![platform](https://img.shields.io/badge/platform-Windows-lightgrey) ![license](https://img.shields.io/badge/license-MIT-green)

---

## ✨ 特性

### 核心编辑
- **所见即所得渲染** —— CommonMark + GFM（表格、删除线、任务列表、围栏代码）
- **Typora 式即时渲染** —— 键入 `# 空格` 立即变 H1、`**粗体**` 自动格式化
- **完整快捷键** —— Ctrl+B/I/K 加粗/斜体/链接、Ctrl+Z/Y 撤销重做、Ctrl+F 查找替换、Ctrl+1/2/3 标题级别
- **工具栏** —— H1/H2/H3、列表、引用、代码块、链接、图片、3×3 表格、分割线
- **粘贴 Markdown 自动格式化**
- **拖拽 / 粘贴图片自动保存到 `<fileDir>/assets/`**

### 任务列表 / 数学 / 图表（v0.2）
- **GFM 任务列表** —— `- [ ]` / `- [x]` 渲染为紫色 ☐ / ☑ checkbox，点击切换
- **KaTeX 行内 + 块级公式** —— `$E=mc^2$` / `$$...$$` 实时渲染；双击进入源码编辑
- **Mermaid 图表** —— ` ```mermaid ` 代码块自动渲染为 SVG；双击编辑源
- **Shiki 代码高亮** —— 14 种语言，与 VSCode 同款主题

### 文件管理
- **多标签页** —— 同时打开多个文件，标签可关闭
- **文件树** —— 递归展开/折叠的目录树，懒加载
- **侧栏三 tab** —— 文件 / 大纲 / 图片（点击大纲跳转；点击图片插入 `![name](./assets/...)`）
- **新建 .md** —— 一键创建
- **Ctrl+O 打开** —— 原生文件选择器
- **记住工作目录** —— 重启自动恢复

### 文档导出（三格式）
- **HTML** —— 内联 CSS + GitHub 主题（light/dark），双击直接浏览器打开
- **PDF** —— 调用 WebView2 原生 `PrintToPdfAsync`，无需弹窗、100% 离线、可指定任意路径
- **Word（.docx）** —— 真 OOXML（ECMA-376），用 `docx` npm 包生成，Word 2016+ / WPS / LibreOffice / Google Docs 全部直接打开

### 数据安全
- **自动保存** —— 编辑后 300ms 静默写盘，tab 显示脏标记
- **崩溃恢复** —— 异常退出后启动弹"未保存的会话"对话框
- **原子写** —— 写盘先写 `.tmp` 再 rename，避免写一半崩溃损坏源文件
- **外部修改检测** —— 别的程序改了你的文件，弹窗问"加载外部版 / 保留我的"

### 编辑器增强
- **查找 / 替换（v0.2 增强）** —— Ctrl+F 打开，Enter 跳下一个，Esc 关闭；支持**正则**（`.*` 切换）和**区分大小写**（`Aa` 切换）
- **多光标（v0.2）** —— Ctrl+D 选中当前词后再次按下跳到下一匹配，逐个加选区
- **行/列位置** —— 底部状态栏实时显示光标 Ln N, Col M
- **字数统计** —— 实时显示词数 / 字符数
- **主题切换** —— 浅色 / 深色
- **自动滚动** —— 切 tab 时活动 tab 自动滚到可见
- **保存状态指示** —— 顶部 `● 未保存` / `✓ 已自动保存`

---

## 📸 截图

### 主界面（深色主题、菜单栏 + 侧栏 + 状态栏）

![sharkmd 主界面](./docs/screenshots/01-main.png)

*首次启动后：左侧"文件"tab + 提示选择工作目录；中央欢迎页；底部状态栏。*

### 布局说明

```
┌─ 菜单栏 (文件 / 编辑 / 段落 / 格式 / 视图 / 主题 / 帮助) ──────────┐
├─ Tabs: [123.md] [456.md●] [data.md] ─────────────────────────────┤
├─ 文件/大纲 ─┬─ 工具栏 ─────────────────────────────────────────┤
│  ▼ docs      │  H1 H2 H3 | B I S </> | • 列表 1. 列表 " 引用 |  │
│    ▼ proj    │  🔗 — 分割 | ⊞ 表格 ``` 代码 🖼 图片              │
│      a.md    │  ────────────────────────────────────────────────  │
│    b.md      │  # Welcome to sharkmd                              │
│  plugins/    │                                                    │
│  satinfo/    │  **bold** _italic_ ~~strike~~ `inline code`        │
│              │                                                    │
│              │  - bullet                                          │
│              │  1. ordered                                       │
│              │                                                    │
├──────────────┴─ 状态栏 ──────────────────────────────────────────┤
│ ✓ 已自动保存 | D:\docs\a.md | 1 词 · 12 字符 | P Ln 1, Col 6 | UTF-8 │
└──────────────────────────────────────────────────────────────────┘
```

### v0.2 新能力

![sharkmd v0.2 — 任务列表 + KaTeX 数学公式](./docs/screenshots/v0.2-main.png)

*v0.2 一图展示：GFM 任务列表（紫色 checkbox）+ KaTeX 行内/块级公式实时渲染。下方 Mermaid 图表、Shiki 代码高亮（与 VSCode 同款）、文档导出、查找正则/Ctrl+D 多光标、图片管理面板也已实现。*

### 各 UI 元素

| 区域 | 元素 | 说明 |
|------|------|------|
| **菜单栏** | 文件 / 编辑 / 段落 / 格式 / 视图 / 主题 / 帮助 | 7 个下拉菜单，几乎所有操作都可达 |
| **标签栏** | 打开的文件 tabs | 当前活动 tab 加粗 + 蓝色下划线 + 自动滚到可见 |
| **侧栏** | 文件 tab + 大纲 tab | 切换 tab 显示 FileTree 或 Outline（从当前文档抽 heading） |
| **工具栏** | H1/H2/H3 · B/I/S · 列表 · 引用 · 链接 · 分割 · 表格 · 代码 · 图片 | 一键插入 Markdown 元素 |
| **编辑器** | WYSIWYG | 键入即渲染，无预览/编辑模式切换 |
| **状态栏** | 保存状态 · 路径 · 词数/字符数 · Ln/Col · 块类型 · 编码 | 实时显示光标位置 |
| **查找条** | Ctrl+F | 顶部弹出，Enter 跳下一个匹配 |

### 与同类的对比

| 特性 | sharkmd | Typora | Obsidian | Mark Text | VSCode |
|------|:---:|:---:|:---:|:---:|:---:|
| 所见即所得 | ✅ | ✅ | ⚠️ 预览 | ✅ | ❌ 双栏 |
| 本地优先 / 离线 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 多标签 / 多文件 | ✅ | ⚠️ 单文档 | ✅ | ⚠️ | ✅ |
| 侧栏文件树 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 文档大纲跳转 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 实时渲染（边输边格式化） | ✅ | ✅ | ❌ | ✅ | ❌ |
| 自动保存 | ✅ | ✅ | ⚠️ | ✅ | ✅ |
| 外部修改检测 | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| 崩溃恢复 | ✅ | ⚠️ | ⚠️ | ❌ | ⚠️ |
| 多端（Win/macOS/Linux） | 🔜 | ✅ | ✅ | ✅ | ✅ |
| 插件系统 | 🔜 v1.0 | ⚠️ 第三方 | ✅ | ❌ | ✅ |
| 同步到云 | 🔜 v1.0 | ⚠️ iCloud | ✅ Obsidian Sync | ❌ | ⚠️ |
| KaTeX 数学 | ✅ v0.2 | ✅ | ✅ | ❌ | ✅ |
| Mermaid 图表 | ✅ v0.2 | ✅ | ✅ | ❌ | ✅ |
| 价格 | 免费 + MIT | $15 一次性 | 免费（同步付费） | 免费 + MIT | 免费 |

---

## 🚀 快速开始

### 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20.10 | pnpm 8 兼容 |
| pnpm | 8.x | 包管理器 |
| Rust | ≥ 1.75 | Tauri 2 后端 |
| **Windows** | | |
| WebView2 | 最新 | Windows 自带/Edge 安装 |
| MSVC Build Tools | 最新 | Windows Rust 编译 |
| **macOS** | | |
| Xcode Command Line Tools | 最新 | `xcode-select --install` 提供 |
| **Linux** | | |
| webkit2gtk-4.1 | 系统包 | `sudo apt install libwebkit2gtk-4.1-dev` |
| 其他系统依赖 | 见下 | librsvg2-dev / patchelf / libssl-dev 等 |

#### Linux 系统依赖

完整 apt 命令（Ubuntu / Debian）：

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev
```

其他发行版等价包名（**仅 Fedora / Arch 备注，不详尽**）：

- **Fedora**：`webkit2gtk4.1-devel` `libappindicator-gtk3-devel` `librsvg2-devel` `openssl-devel` `gcc`
- **Arch**：`webkit2gtk-4.1` `libappindicator-gtk3` `librsvg2` `patchelf` `openssl` `base-devel`

### 安装与运行

```bash
# 1. 克隆
git clone https://github.com/kujirashark/sharkmd.git
cd sharkmd

# 2. 安装依赖
pnpm install

# 3. 启动开发模式（热重载）
pnpm tauri dev

# 4. 打包发布版（Windows MSI / NSIS）
pnpm tauri build
```

首次启动会编译 Rust 依赖（2-3 分钟）。增量编译 5-15 秒。

---

## 🧪 测试

```bash
pnpm test              # 跑 59 个 Vitest 单元/集成测试
pnpm test:watch        # 监听模式
pnpm test:coverage     # 生成 coverage 报告（html/）
pnpm test:e2e          # Playwright E2E（需 tauri-driver）
cargo test --manifest-path src-tauri/Cargo.toml  # 6 个 Rust 集成测试
```

### 测试覆盖

- **编辑器桥接** —— 13 个 roundtrip + 5 个 mdast→tiptap + 4 个 tiptap→mdast = **22 个 roundtrip 黄金测试**，覆盖所有 MVP Markdown 语法 + 任务列表 + KaTeX 数学
- **输入规则** —— 8 个测试覆盖每条 `# `、`**`、`` ` ``、`[` 等规则
- **粘贴检测** —— 2 个测试覆盖 Markdown 粘贴检测
- **导出 DOCX** —— 7 个测试用 jszip 解开 .docx 验证 zip magic bytes / `[Content_Types].xml` / `word/document.xml` / checkbox Unicode / 表格结构 / math / mermaid fallback
- **React 编辑器回归** —— `Editor.test.tsx` 包含 3 个测试：初始挂载 / 插入表格保留前文段落 / Enter 分裂段落为两个
- **Rust 后端** —— 6 个 cargo test 覆盖 fs/draft/settings/外部修改监听
- **UI 状态** —— tabs / theme / autosave / recovery / file tree 各组件

---

## 🏗 架构

### 总体

```
┌─────────────────────────────────────────┐
│  Tauri 2 (Rust)                          │
│   ├─ commands/fs (open/save/save_as/    │
│   │              save_binary_file/...)  │
│   ├─ commands/print (PDF via WebView2   │
│   │                  PrintToPdfAsync)   │
│   ├─ commands/draft (崩溃恢复)            │
│   ├─ commands/settings (主题/上次目录)    │
│   └─ watch (notify crate, 外部修改监听)  │
└──────────────────┬──────────────────────┘
                   │ Tauri IPC (typed)
┌──────────────────▼──────────────────────┐
│  React 18 + TypeScript                   │
│   ├─ editor/    (TipTap + 桥接 + 扩展)   │
│   ├─ export/    (HTML / PDF / DOCX)     │
│   ├─ tabs/      (Zustand 状态)            │
│   ├─ sidebar/   (文件树 + 大纲 + 图片)   │
│   ├─ theme/     (CSS 变量)              │
│   ├─ assets/    (图片粘贴 + 哈希命名)    │
│   ├─ autosave/  (300ms debounce)         │
│   └─ app/       (AppShell + MenuBar +   │
│                  StatusBar + FindBar)    │
└─────────────────────────────────────────┘
```

### 数据流（打开 .md）

```
FileTree click "a.md"
  → AppLayout.openFileByPath(path)
    → tauri.openFile(path)        [Rust: 读 + UTF-8 + mtime]
      → parseMarkdown(text)      [unified + remark-gfm → TipTap JSON]
        → addTab({content: json, ...})  [Zustand: tabs + activeId]
          → Editor receives new value
            → useEditor setContent(json, false)
              → ProseMirror renders
              → onUpdate → autosave.schedule(tabId)
```

### 桥接（核心）

```
.md 文件  ──[unified + remark-parse + remark-gfm]──>  MDAST (AST)
         ──[mdastToTiptap (bridge/mdast-to-tiptap)]─>  TipTap JSON
         ──[tiptapToMdast (bridge/tiptap-to-mdast)]─>  MDAST
         ──[unified + remark-stringify]─────────────>  .md 字符串
```

**保证**：`parse → serialize` 9 个黄金 fixture 完整 roundtrip。

---

## 📁 目录结构

```
sharkmd/
├─ src/                          # React 前端
│  ├─ app/                       # 应用壳
│  │  ├─ App.tsx                 # 根组件，注入 test hook
│  │  ├─ AppLayout.tsx           # 三栏布局：侧栏 + 编辑器 + 状态栏
│  │  ├─ MenuBar.tsx             # 7 菜单
│  │  ├─ SidebarTabs.tsx         # 文件/大纲 tab
│  │  └─ StatusBar.tsx           # 底部状态栏
│  ├─ editor/                    # 编辑器核心
│  │  ├─ Editor.tsx              # React wrapper
│  │  ├─ Toolbar.tsx             # 格式工具栏
│  │  ├─ FindBar.tsx             # 查找替换（v0.2：正则/区分大小写/多光标）
│  │  ├─ schema/                 # ProseMirror schema (16 nodes + 5 marks)
│  │  ├─ bridge/                 # MDAST ↔ TipTap 双向桥接
│  │  └─ extensions/             # 输入规则、粘贴、快捷键、math、mermaid
│  ├─ export/                    # 文档导出
│  │  ├─ export-html.ts          # → .html（github-light/github-dark）
│  │  ├─ export-docx.ts          # → .docx（真 OOXML，Word 2016+/WPS 兼容）
│  │  └─ export-docx.test.ts     # jszip 解压验证
│  ├─ tabs/                      # 多标签 store
│  ├─ sidebar/                   # 文件树 + 大纲 + 图片管理
│  ├─ theme/                     # 主题 CSS
│  ├─ assets/                    # 图片处理（粘贴 → <fileDir>/assets/）
│  ├─ autosave/                  # 300ms debounce 自动保存
│  ├─ crash-recovery/            # 崩溃恢复对话框
│  ├─ tauri/                     # IPC 客户端（saveFile / saveBinaryFile / printToPdf）
│  └─ utils/                     # 工具（hashPath, etc.）
├─ src-tauri/                    # Rust 后端
│  ├─ src/
│  │  ├─ main.rs                 # 入口
│  │  ├─ lib.rs                  # 注册 Tauri 命令
│  │  ├─ error.rs                # AppError 类型
│  │  ├─ log_setup.rs            # 日志
│  │  └─ commands/
│  │     ├─ fs.rs                # open/save/save_as/save_binary_file/
│  │     │                       #   read_dir/watch/save_asset
│  │     ├─ print.rs             # print_to_pdf（WebView2 PrintToPdfAsync）
│  │     ├─ draft.rs             # save/list/delete draft
│  │     └─ settings.rs          # get/set settings
│  ├─ tests/                     # 6 个 cargo 集成测试
│  ├─ capabilities/
│  │  └─ default.json            # Tauri 2 permissions
│  ├─ Cargo.toml
│  └─ tauri.conf.json
├─ tests/
│  └─ e2e/                       # Playwright (forward-looking)
├─ docs/
│  └─ superpowers/
│     ├─ specs/                  # 设计文档
│     └─ plans/                  # 实施计划
├─ .github/
│  └─ workflows/ci.yml           # Windows CI
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

---

## 📤 导出格式

| 格式 | 后缀 | 实现 | 优势 | 限制 |
|---|---|---|---|---|
| **HTML** | `.html` | 内联 CSS + GitHub 主题 | 双击浏览器直接打开；体积小 | 无原生 PDF/打印样式；需要浏览器渲染 |
| **PDF** | `.pdf` | WebView2 `ICoreWebView2_7::PrintToPdfAsync` | **无需弹窗**、100% 离线、可指定任意路径；分页由浏览器决定 | 仅 Windows（macOS/Linux 暂未实现） |
| **Word** | `.docx` | `docx` npm 包生成真 OOXML zip（ECMA-376） | **Word 2016+ / WPS / LibreOffice / Google Docs** 全部直接打开；保留标题、表格、checkbox、代码块样式 | math 公式降级为 LaTeX 源码（v3 计划引入 OMML）；mermaid 降级为带框文本 |

**为什么 Word 不再是 `.doc + MSO PI`？**
v0.1 早期方案用 HTML+MSO PI 假冒 .doc，Word 2016+ 越来越严格会显示源码，WPS 兼容性参差不齐。v0.2 改为**真 OOXML**，符合 ECMA-376 / ISO/IEC 29500 国际标准。

**为什么 PDF 不再走 `window.print()`？**
Tauri 2 的 WebView2 沙箱阻止弹窗，`window.open()` 和 `window.print()` 都被拦截。v0.2 用 `webview2-com` crate 直接调原生 `PrintToPdfAsync` IPC 命令，绕过弹窗。

---

## ⌨️ 快捷键速查

### 编辑
| 快捷键 | 动作 |
|---|---|
| `Ctrl+B` / `Cmd+B` | 加粗 |
| `Ctrl+I` / `Cmd+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+F` | 查找 / 替换 |
| `Ctrl+0/1/2/3` | 段落 / H1 / H2 / H3 |
| `Ctrl+S` | 立即保存（自动保存已运行） |
| `Ctrl+W` | 关闭当前标签 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+N` | 新建文件 |
| `Esc` | 关闭查找条 |

### 即时渲染（键入即格式化）
| 输入 | 变 |
|---|---|
| `# ` | H1 |
| `## ` / `### ` / `#### ` | H2 / H3 / H4 |
| `**text**` | **text** |
| `*text*` / `_text_` | *text* |
| `~~text~~` | ~~text~~ |
| `` `code` `` | 行内 code |
| `[text](url)` | 链接 |
| `- ` / `* ` / `+ ` | 无序列表 |
| `1. ` | 有序列表 |
| `> ` | 引用 |
| ` ``` ` | 代码块 |
| `---` | 分割线 |

---

## 🔧 故障排查

### `pnpm tauri dev` 启动失败
- 端口 1420 被占用：`netstat -ano | grep 1420`，杀掉占用的 node 进程
- Cargo 编译错误：检查网络（crates.io 是否可达）
- WebView2 缺失：Windows 安装 [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/)

### 编辑器打开 .md 空白
- 看顶部 `[dbg: content≈N bytes]` —— `N > 100` 是编辑器层 bug；`N < 50` 是 openFile 问题
- 看浏览器 DevTools（F12）Console 错误
- 试 `pnpm tauri dev` 完全重启（不要靠 HMR）

### Rust 编译 OOM / 卡死
- 编辑 `Cargo.toml` 改 release profile 用更少优化
- `cargo clean` 然后重试

### E2E 跑不起来
- 需要 `cargo install tauri-driver --version "^2.0"`
- WebView2 不可缺失

---

## 🛣 Roadmap

### ✅ MVP（已完成）
- 22 个实现任务 + 6 个 post-review 修复
- 45/45 单元测试 + 6 cargo 测试
- Tauri 2 集成（窗口、命令、事件、capabilities）
- 完整 Markdown 编辑体验

### ✅ v0.2（已完成）
- [x] **任务列表** GFM `- [ ]` / `- [x]` checkbox 渲染 + 勾选
- [x] **KaTeX 数学公式** `$E=mc^2$` 实时渲染（双击进入编辑）
- [x] **Mermaid 图表** ` ```mermaid ` 代码块自动渲染为 SVG（双击编辑源）
- [x] **Shiki 代码语法高亮** ts/js/json/python/rust/go 等 14 种语言，与 VSCode 同款
- [x] **文档导出三格式** HTML（GitHub 主题）/ PDF（**WebView2 原生 PrintToPdf**）/ Word（**.docx 真 OOXML**，Word 2016+/WPS 兼容）
- [x] **查找增强** 正则（`.*`） + 区分大小写（`Aa`） 切换
- [x] **多光标** Ctrl+D 跳到下一匹配
- [x] **图片管理面板** 侧栏切到"图片"tab，列出 `<fileDir>/assets/`，点击插入 `![name](./assets/...)`
- [x] **编辑器稳定性修复** Enter 换行（math NodeView `contentEditable={false}`）/ 插入表格保留前文（受控模式深相等守卫）/ 图片粘贴落盘（`MarkdownPaste` 接 `image/*` items）

### ✅ v0.3（已完成）
- [x] **跨文件搜索** —— Ctrl+Shift+F，工作目录内所有 .md 文件全局搜索；正则 / 大小写切换；结果按文件分组；点击跳转到对应文件 + 行号 + 列
- [x] **英文 UI + i18n 框架** —— 全 UI 字符串可翻译；菜单新增「语言」切换（zh-CN / en-US）；设置持久化
- [x] **真多光标** —— `Ctrl+Shift+D`（不用 Ctrl+D 因 WebView2 吞）累积多光标；`Alt+Click` 插入第二光标；`Escape` 折叠回单光标
- [x] **列选择矩形** —— `Alt+拖拽` 选矩形选区，蓝色高亮；输入多 range 同步
- [x] **macOS / Linux / Windows 三平台打包** —— universal binary + AppImage + .deb + MSI；GitHub Actions 三平台矩阵 + cargo test
- [x] **完整三平台图标** —— `.icns` / `.ico` / 多尺寸 `.png`

### ✅ v0.4（已完成）
- [x] **拼写检查（英文）** —— nspell + Web Worker 异步扫描；错词红色波浪下划线；侧栏"拼写"tab 列出错误列表；一键替换建议；菜单「视图 → 拼写检查」开关
- [x] **更新检查** —— 菜单「帮助 → 检查更新」调 GitHub Releases API，弹窗显示最新版号 + 发布时间 + release notes + 跳转 GitHub release 页手动下载（v0.4 不签 TAURI 签名密钥）
- [x] **新增组件** —— `Modal` / `PromptModal`（替换 Tauri 不可靠的 `window.prompt`）+ `UpdaterPanel`
- [x] **编辑器 bug 修复**（v0.3 修复 + v0.4 新发现）
  - Enter 不能换行 → MarkdownInputRules 用了错误 API（修）
  - Enter 后回退原行 → 受控模式深相等 guard
  - 插入表格清空 → autosave 自身的 fs:external-change 触发 reload（修）
  - 新建文件没反应 → `if (!editor) return` 守卫 + window.prompt 在 WebView2 被吞
  - Ctrl+S 不响应 → 全局快捷键监听补全
  - RecoveryDialog 缺恢复按钮 → Rust 加 read_draft + UI 加 Restore

### 🚀 v1.0（中期）
- [ ] **插件系统**：用户自定义扩展
- [ ] **主题商店**：可下载的 .css 主题
- [ ] **同步**：本地文件夹 + 云（iCloud / Dropbox / 自建 WebDAV）
- [ ] **版本历史**：基于 Git 的本地版本
- [ ] **macOS / Linux 代码签名 + Apple 公证**
- [ ] **tauri-plugin-updater 集成**（v0.4 用 Web 跳转代替；v1.0 接签名密钥做 in-app update）
- [ ] **拼写检查增量扫描**（只扫可见视口，不全文档重扫）
- [ ] **中文拼写支持**（nspell + dictionary-zh-cn；v0.4 留 placeholder）

### 🌌 远期
- [ ] 协同编辑（Yjs / CRDT）
- [ ] 移动端（iPad / Android 平板）

---

## 🤝 贡献

欢迎 PR / Issue！

### 提交规范
- `feat:` 新功能
- `fix:` bug 修复
- `chore:` 杂项（依赖、构建）
- `test:` 仅测试
- `docs:` 仅文档
- `style:` 不改变行为的格式
- `refactor:` 重构

### 开发流程
1. Fork 仓库
2. 创建分支：`git checkout -b feat/your-feature`
3. 写测试 + 实现
4. `pnpm test` + `cargo test` 全过
5. `pnpm exec tsc --noEmit` 无错误
6. 提交：`git commit -m "feat: ..."`
7. 推分支：`git push origin feat/your-feature`
8. 开 PR

---

## 📜 License

MIT © kujirashark

---

## 🙏 致谢

- [Tauri](https://tauri.app/) — 跨平台桌面应用框架
- [TipTap](https://tiptap.dev/) — 基于 ProseMirror 的编辑器
- [unified / remark](https://github.com/remarkjs/remark) — Markdown 解析
- [Typora](https://typora.io/) — UX 灵感来源

> 任何问题看 `docs/superpowers/specs/` 里的设计文档和 `docs/superpowers/plans/` 里的实施计划。
