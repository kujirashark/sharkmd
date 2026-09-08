import { create } from 'zustand';
import type { JSONContent } from '@tiptap/core';
import { hashPath } from '../utils/hash-path';

export interface Tab {
  id: string;
  path: string;
  title: string;
  dirty: boolean;
  content: JSONContent;
  mtimeMs: number;
  /**
   * Optional cursor target set by SearchPanel when opening a file.
   * The Editor consumes it once on mount: it converts the (line, col)
   * pair to a ProseMirror position and calls setTextSelection.
   */
  initialJump?: { line: number; col: number };
}

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  addTab: (t: Omit<Tab, 'dirty' | 'id'>) => string;
  closeTab: (id: string) => void;
  setActive: (id: string) => void;
  updateContent: (id: string, content: JSONContent, dirty?: boolean) => void;
  setMtime: (id: string, mtimeMs: number) => void;
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,
  addTab: (t) => {
    const id = hashPath(t.path);
    const existing = get().tabs.find((x) => x.id === id);
    if (existing) {
      set({ activeId: id });
      return id;
    }
    const tab: Tab = { id, dirty: false, ...t };
    set({ tabs: [...get().tabs, tab], activeId: id });
    return id;
  },
  closeTab: (id) => {
    const tabs = get().tabs.filter((t) => t.id !== id);
    const activeId = get().activeId === id ? tabs[0]?.id ?? null : get().activeId;
    set({ tabs, activeId });
  },
  setActive: (id) => set({ activeId: id }),
  updateContent: (id, content, dirty = true) => {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, content, dirty } : t)) });
  },
  setMtime: (id, mtimeMs) => {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, mtimeMs } : t)) });
  },
}));
