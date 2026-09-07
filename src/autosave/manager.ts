import { tauri } from '../tauri/client';
import { serializeMarkdown } from '../editor/bridge';
import type { Tab } from '../tabs/store';

interface Opts {
  getTab: () => Tab | undefined;
  debounceMs?: number;
}

export function createAutoSave({ getTab, debounceMs = 300 }: Opts) {
  let timer: number | null = null;
  let stopped = false;

  async function run(tab: Tab) {
    const md = serializeMarkdown(tab.content);
    await Promise.allSettled([
      tauri.saveFile(tab.path, md).catch(() => null),
      tauri.saveDraft(tab.id, JSON.stringify(tab.content), tab.path).catch(() => null),
    ]);
  }

  return {
    schedule(tabId: string) {
      if (stopped) return;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        const tab = getTab();
        if (tab && tab.id === tabId) void run(tab);
      }, debounceMs);
    },
    stop() {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
    },
    flush() {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
        const tab = getTab();
        if (tab) void run(tab);
      }
    },
  };
}