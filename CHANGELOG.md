# Changelog

所有 sharkmd 的版本变更记录。格式遵循 [Keep a Changelog](https://keepachangelog.com/)。

## [0.3.0] - 2026-XX-XX

首个**多平台公开发行版**。sharkmd 现在可在 Windows / macOS / Linux 三平台下载安装。

### 新增功能

- **跨文件搜索** —— 工作目录内所有 .md 文件全局搜索；正则 / 大小写切换；结果按文件分组；点击跳转到对应文件 + 行号 + 列。快捷键 `Ctrl+Shift+F` (macOS `Cmd+Shift+F`)。
- **英文 UI + i18n 框架** —— 全 UI 字符串可翻译；菜单新增「语言」切换（zh-CN / en-US）；设置持久化。底层 react-i18next。
- **真多光标** —— `Ctrl+D` 累积多光标（VS Code 风格）；`Alt+Click` 插入第二光标；`Escape` 折叠回单光标。
- **列选择矩形** —— `Alt+拖拽` 选矩形选区，蓝色高亮；输入多 range 同步。

### 跨平台

- **macOS** —— 首个 macOS 版本，universal binary (Apple Silicon + Intel)。
- **Linux** —— AppImage + deb；要求 webkit2gtk-4.1 系统库。
- **CI** —— GitHub Actions 三平台矩阵 + cargo test 跨平台运行。
- **图标** —— 完整三平台图标集（.icns / .ico / 多尺寸 .png）。

### 改进

- 编辑器稳定性 3 个回归修复：Enter 换行 / 插入表格保留前文 / 图片粘贴落盘
- 文档导出三格式：HTML / PDF (WebView2 原生 PrintToPdf) / Word (真 OOXML .docx)
- 自动保存 + 原子写 + 外部修改检测 + 崩溃恢复
- 任务列表 / KaTeX / Mermaid / Shiki 等 v0.2 能力全部保留

### 下载

- Windows: `.msi` / `.exe`
- macOS: `.dmg` (universal)
- Linux: `.AppImage` / `.deb`

### 已知问题

- macOS / Windows / Linux 安装包**未签名**：首次启动 macOS 需右键"打开"绕过 Gatekeeper，Windows SmartScreen 警告需"更多信息 → 仍要运行"。v1.0 才做代码签名。
- Linux 仅在 Ubuntu 22.04 测试过，其他发行版可能需要额外配置。

---

## [0.2.x] - 2026-09 (内测)

Windows 内测版本。完整 Markdown 编辑体验：所见即所得、任务列表、KaTeX / Mermaid / Shiki、文档导出三格式、查找替换（含正则 / 大小写 / 多光标占位）、多标签、文件树、自动保存、外部修改检测、崩溃恢复。

---

## [0.1.0] - 2026-XX-XX

MVP 初版。
