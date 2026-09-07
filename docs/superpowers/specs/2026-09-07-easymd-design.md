# easymd — 产品级 Markdown 编辑器（对标 Typora）设计文档

| 字段 | 值 |
|---|---|
| 日期 | 2026-09-07 |
| 状态 | Approved by user |
| 阶段 | MVP |
| 平台优先级 | Windows 优先（其他平台代码兼容，但不主动交付） |

---

## 1. 背景与目标

`easymd` 是一个产品级的 Markdown 编辑器，对标 **Typora** 的核心体验：所见即所得的"即时渲染"——键入 Markdown 语法的瞬间即被替换为格式化文本，无独立源码模式（或仅供高级用户）。

### MVP 范围

**包含**：
- 富文本编辑内核（TipTap / ProseMirror）
- CommonMark + GFM 解析与序列化（remark/unified）
- Typora 式即时渲染（自研 Markdown Input Rules）
- 多标签页 + 文件树侧栏 + 最近文件列表
- 大纲（自动从当前 tab 的 heading 树派生，无独立存储；侧栏视图）
- 文件打开 / 保存 / 另存为 / 自动保存
- 崩溃恢复（draft 缓存 + 启动提示）
- 基础主题（内置浅色 + 深色 + 自定义 CSS 加载）
- 本地图片：粘贴、拖拽、URL 引用（保存到 `<fileDir>/assets/`）

**明确不在 MVP**（后续阶段）：
- PDF / HTML / Word / LaTeX 导出
- 数学公式（KaTeX）与图表（Mermaid）
- 图床上传（SM.MS / Imgur / S3 等）
- 协同编辑 / Yjs 集成
- 版本历史与时间机器
- 插件系统 / 主题商店
- 多语言（i18n）：MVP 仅中文 UI
- 非 Windows 平台打包与签名

---

## 2. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面壳 | **Tauri 2.x** | Rust 后端 + 系统 WebView；包小、内存低、原生感强 |
| 前端框架 | **React 18 + TypeScript** | TipTap 生态主力；TS 保证编辑器核心可维护 |
| 编辑器内核 | **TipTap 2.x (ProseMirror)** | 所见即所得 Markdown 编辑器事实标准；Input Rules 适合 Typora 体验 |
| Markdown 解析 | **unified + remark-parse + remark-gfm + remark-stringify** | CommonMark + GFM 准标；插件生态丰富 |
| 状态管理 | **Zustand** | 轻量、跨标签隔离简单、SSR/CSR 兼容 |
| 构建 | **Vite + pnpm** | Tauri 官方推荐；HMR 快 |
| 测试 | **Vitest（单测）+ Playwright + tauri-driver（E2E）** | Vitest 与 Vite 集成；E2E 用 tauri-driver 才能驱动 WebView 内的 IPC |
| 日志 | **tauri-plugin-log** | 写 `${dataDir}/logs/YYYY-MM-DD.log` |

---

## 3. 高层架构

```
┌─────────────────────────────────────────────────────────┐
│  Tauri (Rust)                                            │
│   ├─ commands/fs.rs       open/save/read_dir/watch       │
│   ├─ commands/draft.rs    draft 读写                     │
│   └─ commands/settings.rs 主题/字体/快捷键                │
└──────────────────────────┬───────────────────────────────┘
                           │ Tauri IPC (typed commands)
┌──────────────────────────▼───────────────────────────────┐
│  React 前端                                              │
│   ├─ editor/          内核（extensions/schema/bridge）   │
│   ├─ tabs/            标签页 store + UI                  │
│   ├─ sidebar/         文件树 + 大纲                      │
│   ├─ theme/           CSS 变量 + 主题切换                 │
│   ├─ assets/          图片处理                           │
│   ├─ autosave/        debounce + draft 持久化             │
│   └─ tauri/           IPC 客户端封装                      │
└──────────────────────────────────────────────────────────┘
```

### 模块边界（前端）

| 目录 | 职责 | 关键依赖 |
|---|---|---|
| `editor/Editor.tsx` | 给一个 `fileId` 渲染编辑器，暴露 `getJSON()`/`focus()` | tiptap, bridge |
| `editor/extensions/markdown-input-rules.ts` | TipTap 扩展：监听 `#`/`**`/`[]()` 等模式，命中即转 node/mark | prosemirror-input-rules |
| `editor/extensions/markdown-paste.ts` | 粘贴 Markdown 文本时立即按格式渲染 | tiptap |
| `editor/extensions/markdown-keymap.ts` | Typora 风格快捷键（Ctrl+B/I/K 等） | tiptap |
| `editor/schema/nodes.ts` | heading/paragraph/codeblock/list/blockquote/hr/image/table 等 schema | tiptap |
| `editor/schema/marks.ts` | bold/italic/strike/code/link 等 mark schema | tiptap |
| `editor/bridge/mdast-to-tiptap.ts` | 纯函数：MDAST → TipTap JSON | unified |
| `editor/bridge/tiptap-to-mdast.ts` | 纯函数：TipTap JSON → MDAST | unified |
| `tabs/` | 标签页 store（Zustand slice）+ UI；管理 active tab / dirty | tauri client |
| `sidebar/` | 文件树 + 大纲；订阅当前 tab 的编辑器状态 | tiptap |
| `theme/` | CSS 变量 + 主题切换 + 自定义 CSS 加载 | — |
| `assets/` | 粘贴/拖拽图片 → 调用 `tauri.save_asset` → 插入 `<fileDir>/assets/` 引用 | tauri client |
| `autosave/` | 订阅 editor onUpdate → debounce 300ms → IPC 写盘 + draft | tauri client |
| `tauri/` | 类型化 `invoke()` 包装；错误统一映射 `AppError` | @tauri-apps/api |

### Rust 命令（IPC 接口契约）

```rust
// commands/fs.rs
#[tauri::command]
async fn open_file(path: PathBuf) -> Result<FileContent, AppError>;
#[tauri::command]
async fn save_file(path: PathBuf, content: String) -> Result<SaveResult, AppError>;
#[tauri::command]
async fn save_as(src_path: PathBuf, dest_path: PathBuf, content: String) -> Result<(), AppError>;
#[tauri::command]
async fn read_dir(path: PathBuf) -> Result<Vec<DirEntry>, AppError>;
#[tauri::command]
async fn watch(path: PathBuf, app: AppHandle) -> Result<(), AppError>;
// emits "fs:external-change" { path, mtime_ms } 前端收到后通知相关 tab 进入"外部修改"状态

// commands/draft.rs
#[tauri::command]
async fn save_draft(file_id: String, json: String) -> Result<(), AppError>;
#[tauri::command]
async fn list_drafts() -> Result<Vec<DraftEntry>, AppError>;
#[tauri::command]
async fn delete_draft(file_id: String) -> Result<(), AppError>;

// commands/settings.rs
#[tauri::command]
async fn get_settings() -> Result<Settings, AppError>;
#[tauri::command]
async fn set_settings(s: Settings) -> Result<(), AppError>;
```

---

## 4. 数据流

### 4.1 打开 .md 文件

```
[用户点击文件树节点]
   ↓
tabs store: addTab(fileId, path)
   ↓
tauri.invoke('open_file', { path })
   ↓  [Rust: fs::read_to_string, UTF-8, size 检查]
   ↓
unified().use(remark-parse).use(remark-gfm).parse(text)
   ↓
bridge/mdast-to-tiptap(mdast) → TipTap JSON
   ↓
Editor.tsx setContent(json) → 渲染
   ↓
autosave watcher: 监听该 tab 的 dirty 状态
```

### 4.2 Typora 式即时渲染

```
用户键入 '# '
   ↓
ProseMirror Transaction 触发
   ↓
markdown-input-rules 扩展遍历 InputRule：
   - 检测当前段落文本 + 末尾空格 pattern
   - 命中 → transform(): 把 paragraph 转 heading(level=1)，清掉 #
   ↓
[同一 transaction 内完成，零延迟，无外部 IPC]
```

**输入规则 MVP 覆盖**：
- 块级：`# ` `## ` `### ` `#### ` `- ` `1. ` `> ` ` ``` ` `---`
- 行内：`**text**` `*text*` `_text_` `~~text~~` `` `code` `` `[text](url)`

### 4.3 自动保存（双轨：磁盘文件 + draft 缓存）

```
Editor onUpdate 事件
   ↓
[300ms debounce] → 触发 autosave tick
   ↓  [并行两条轨道]
   ├─→ TipTap JSON → MDAST → remark-stringify
   │     → tauri.save_file(path, content)
   │     [Rust: 原子写 tmp + rename；保存前检查 mtime]
   │     若磁盘文件被外部修改：弹窗"覆盖 / 放弃 / 用外部版本"
   └─→ TipTap JSON → tauri.save_draft(fileId, json)
         [用于崩溃恢复；${dataDir}/draft/<sha256(absolute_path)>.json]
```

### 4.4 关闭应用 / 崩溃恢复

```
App 启动
   ↓
list_drafts() → 读取 draft/ 目录所有 <hash>.json
   ↓
对每个 draft：
   - 反查 path 是否还在磁盘 → 比对磁盘 mtime
   - 若 draft 更新：标记为"可恢复"，启动时侧栏提示"未保存的会话"
   - 用户选择恢复 → 用 draft JSON 覆盖当前 tab 内容
```

### 4.5 图片粘贴/拖拽

```
[剪贴板/拖拽事件] 携带 image/png (binary)
   ↓
tauri.invoke('save_asset', { sourceDir, filename, bytes })
   ↓  [Rust: 以 SHA-256(content) 为文件名写入 <fileDir>/assets/<sha>.<ext>；
        若已存在则复用，不重复写；
        Markdown 引用路径按 URL 规则 percent-encode 空格/中文等非 ASCII]
   ↓
返回相对路径 './assets/foo.png'
   ↓
Editor 插入 ![alt](./assets/foo.png)
```

---

## 5. 错误处理

| 错误来源 | 检测位置 | 用户提示 | 恢复策略 |
|---|---|---|---|
| 打开文件不存在/无权限 | Rust `fs::read` | Toast：无法打开 {path} | 关闭该 tab |
| 文件非 UTF-8 | Rust `from_utf8_lossy` 替换 | 警告条：检测到非 UTF-8 字符 | 继续打开；保存时按 UTF-8 |
| 文件超大（>10MB） | Rust size 检查 | 提示：文件较大，编辑器可能变慢 | 用户选择继续或取消 |
| 解析失败（remark） | `unified().parse` 抛错 | Toast：解析失败，已降级为纯文本 | 降级显示为 code block 文本 |
| 保存失败（磁盘满/只读） | Rust `fs::write` 失败 | Toast：保存失败，原因 {err} | 保留 tab dirty 状态 |
| 外部修改冲突 | 保存前比 mtime | Modal：文件已被外部修改。选项：覆盖 / 放弃 / 用外部版本 | 三选项 |
| Tauri IPC 失败 | 前端 invoke try/catch | Toast：内部错误 | 控制台记录 |
| WebView 崩溃 | OS 进程消失 | 应用重启；启动时进入"崩溃恢复"流程 | 见 §4.4 |
| 输入规则未识别 | 静默 | 不提示 | N/A |

**通用原则**：
- 错误永不导致整个应用崩溃；最坏情况：当前 tab 进入"只读纯文本"降级模式
- 所有 Tauri 命令返回 `Result<T, AppError>`；`AppError` 序列化含 `code` + `message`（用户友好）+ `detail`（技术细节，dev 模式显示）
- 日志：`[component] message` 格式，文件 `${dataDir}/logs/YYYY-MM-DD.log`

---

## 6. 测试策略

### 测试金字塔

```
       E2E（少量，覆盖关键用户旅程）
      ───────────────────────────────
     集成（中等：bridge roundtrip、autosave 协调）
    ──────────────────────────────────────────
   单元（大量：纯函数、扩展、状态切片）
  ───────────────────────────────────────────
```

### 关键测试矩阵

| 层 | 对象 | 工具 | 覆盖 |
|---|---|---|---|
| 单元 | `bridge/mdast-to-tiptap.ts` | Vitest | ≥50 个 fixture：标题、列表、表格、代码块、链接、图片、强调 |
| 单元 | `bridge/tiptap-to-mdast.ts` | Vitest | 同上反向 |
| 单元 | `markdown-input-rules` | Vitest + jsdom + prosemirror test-builder | 每条规则触发；边界：行中间、已有 mark 冲突 |
| 单元 | `tabs` store | Vitest | 开/关/切换/脏标记/未保存提示 |
| 单元 | `theme` | Vitest | CSS 变量切换；自定义 CSS 加载/卸载 |
| 集成 | bridge roundtrip | Vitest | `mdast→tt→mdast === mdast`（规范化后）；GFM、嵌套列表、表格 |
| 集成 | autosave 协调 | Vitest + fake tauri client | 编辑 → 300ms 后 IPC；编辑器销毁后停止 debounce |
| 集成 | 崩溃恢复 | Vitest + fake tauri/fs | 启动检测 draft → 恢复流程 |
| E2E | 用户旅程 | Playwright + tauri-driver | ① 打开 .md → 输入 → 看到格式化 ② 切 tab → 保存 → 关闭 ③ 杀进程 → 重启 → 恢复 |
| E2E | 视觉回归 | Playwright screenshot | 主题切换前后快照对比 |

### 关键不变量（始终成立）

1. **`mdast → tiptap → mdast` 等价**（按 whitespace/emphasis 规范化后）
2. **空文档 serialize 仍为合法 Markdown**
3. **输入规则永不破坏当前光标位置**
4. **autosave 在编辑器卸载后必须停止**（无 IPC 泄漏）

### 覆盖率门槛

- `editor/bridge/*`：≥85%
- `editor/extensions/*`：≥80%
- 其余模块：≥70%

### 运行命令

- `pnpm test`：Vitest 单测
- `pnpm test:e2e`：Playwright（需 `pnpm tauri dev` 在另一端口运行）
- CI：GitHub Actions，Windows runner；缓存 `node_modules`、`target/`、`playwright/`

---

## 7. 项目结构

```
easymd/
├─ crates/
│  └─ easymd-tauri/                 # Rust 后端
│     ├─ src/
│     │  ├─ commands/{fs,draft,settings}.rs
│     │  ├─ error.rs                # AppError + Serialize
│     │  └─ lib.rs
│     ├─ Cargo.toml
│     └─ tauri.conf.json
├─ src/                              # React 前端
│  ├─ app/
│  ├─ editor/
│  │  ├─ extensions/{markdown-input-rules,markdown-paste,markdown-keymap}.ts
│  │  ├─ schema/{nodes,marks}.ts
│  │  ├─ bridge/{mdast-to-tiptap,tiptap-to-mdast,roundtrip.test}.ts
│  │  └─ Editor.tsx
│  ├─ tabs/
│  ├─ sidebar/
│  ├─ theme/
│  ├─ assets/
│  ├─ autosave/
│  └─ tauri/
├─ tests/e2e/                        # Playwright + tauri-driver
├─ docs/superpowers/specs/
├─ tasks/                            # todo.md / lessons.md
├─ package.json
├─ pnpm-lock.yaml
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

---

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| remark ↔ TipTap bridge 复杂度高 | MVP 延期 | 单元测试先写 golden fixture；先支持 MVP 语法集，扩展留到后续 |
| 大文档（>100k 字）性能 | 用户体验差 | 流式 remark-stringify；分页/虚拟滚动（post-MVP） |
| Tauri 2.x WebView 跨平台行为差异 | Windows 之外不可控 | MVP 仅 Win 优先；macOS/Linux 代码兼容但不主动验证 |
| 自研 Input Rules 边界 case 多 | 输入规则错乱 | 单元测试覆盖所有规则 + 边界；e2e 跑实际打字流 |
| WebView 崩溃 | 数据丢失 | draft 双轨保存；启动时恢复流程 |

---

## 9. 后续阶段（不在本 spec）

- 导出（PDF/HTML/Word/LaTeX）
- 数学公式（KaTeX）、图表（Mermaid）
- 图床、协同编辑、版本历史、插件系统
- 主题商店
- i18n（英文 UI）
- 非 Windows 平台打包与签名

---

## 10. 参考

- Tauri 2.x 文档：https://v2.tauri.app/
- TipTap：https://tiptap.dev/
- ProseMirror Guide：https://prosemirror.net/docs/guide/
- unified / remark：https://github.com/remarkjs/remark
- Playwright + tauri-driver：https://github.com/tauri-apps/tauri-driver
