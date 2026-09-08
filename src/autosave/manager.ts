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
  // Track which paths are currently being written by US. The OS notify
  // watcher fires on every atomic-write (rename triggers Create) before
  // our saveFile promise resolves, so the AppLayout `fs:external-change`
  // listener can receive a self-induced event. To prevent the listener
  // from reloading the document mid-write (clobbering unsaved edits like
  // a just-inserted table), we tell the caller "we're about to write
  // path X" BEFORE the IPC roundtrip — see schedule()/flush() below.
  const pendingWrites = new Set<string>();

  async function run(tab: Tab) {
    pendingWrites.add(tab.path);
    const md = serializeMarkdown(tab.content);
    const results = await Promise.allSettled([
      tauri.saveFile(tab.path, md).catch(() => null),
      tauri.saveDraft(tab.id, JSON.stringify(tab.content), tab.path).catch(() => null),
    ]);
    pendingWrites.delete(tab.path);
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
    /** Paths we are currently writing; the AppLayout external-change
     *  listener treats these as our own writes and ignores them. */
    isOurWrite(path: string): boolean {
      return pendingWrites.has(path);
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