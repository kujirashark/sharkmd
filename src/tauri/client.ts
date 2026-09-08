import { invoke } from '@tauri-apps/api/core';

export interface FileContent { text: string; size: number; mtimeMs: number }
export interface SaveResult { mtimeMs: number }
export interface DirEntry { name: string; path: string; isDir: boolean; isMd: boolean }
export interface DraftEntry { fileId: string; path: string; savedAtMs: number }
export interface DraftPayload extends DraftEntry { json: string }
export interface Settings { theme: string; fontSize: number; customCssPath: string | null; lastRootPath?: string | null; language?: string }
export interface AppError { code: string; message: string; detail: string | null }
export interface MdFileEntry { path: string; relPath: string; size: number; mtimeMs: number }
export interface SearchMatch { file: string; relPath: string; line: number; col: number; lineText: string; matchText: string }
export interface SearchRequest { root: string; pattern: string; useRegex: boolean; caseSensitive: boolean; maxResults?: number }

export const tauri = {
  openFile: (path: string) => invoke<FileContent>('open_file', { path }),
  saveFile: (path: string, content: string) => invoke<SaveResult>('save_file', { path, content }),
  saveBinaryFile: (path: string, content: Uint8Array) =>
    invoke<SaveResult>('save_binary_file', { path, content: Array.from(content) }),
  saveAs: (srcPath: string, destPath: string, content: string) =>
    invoke<SaveResult>('save_as', { srcPath, destPath, content }),
  readDir: (path: string) => invoke<DirEntry[]>('read_dir', { path }),
  watch: (path: string) => invoke<void>('watch', { path }),
  saveDraft: (fileId: string, json: string, path?: string | null) =>
    invoke<void>('save_draft', { fileId, json, path: path ?? null }),
  listDrafts: () => invoke<DraftEntry[]>('list_drafts'),
  readDraft: (fileId: string) => invoke<DraftPayload>('read_draft', { fileId }),
  deleteDraft: (fileId: string) => invoke<void>('delete_draft', { fileId }),
  getSettings: () => invoke<Settings>('get_settings'),
  setSettings: (s: Settings) => invoke<void>('set_settings', { s }),
  saveAsset: (sourceDir: string, filename: string, bytes: Uint8Array) =>
    invoke<string>('save_asset', { sourceDir, filename, bytes: Array.from(bytes) }),
  printToPdf: (path: string) => invoke<string>('print_to_pdf', { path }),
  listMarkdownFiles: (root: string) => invoke<MdFileEntry[]>('list_markdown_files', { root }),
  searchInFiles: (req: SearchRequest) => invoke<SearchMatch[]>('search_in_files', { req }),
} as const;
