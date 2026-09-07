import { tauri } from '../tauri/client';
import { serializeMarkdown } from '../editor/bridge';
import type { Tab } from '../tabs/store';

interface Opts {
  getTab: () => Tab | undefined;
  debounceMs?: number;
  onSave?: (path: string) => void;
}

export function createAutoSave({ getTab, debounceMs = 300, onSave }: Opts) {
  let timer: number | null = null;
  let stopped = false;

  async function run(tab: Tab) {
    const md = serializeMarkdown(tab.content);
    const results = await Promise.allSettled([
      tauri.saveFile(tab.path, md).catch(() => null),
      tauri.saveDraft(tab.id, JSON.stringify(tab.content), tab.path).catch(() => null),
    ]);
    // Only notify the listener when the on-disk save actually succeeded;
    // draft saves alone shouldn't suppress external-change events.
    if (results[0].status === 'fulfilled' && results[0].value) {
      onSave?.(tab.path);
    }
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