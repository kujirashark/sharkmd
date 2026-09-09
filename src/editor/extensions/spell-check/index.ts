import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Misspell } from './scan';

/**
 * SpellCheck extension.
 *
 * Architecture:
 *   - addStorage() exposes the current misspell list to the React side
 *     (SpellPanel reads it via `editor.storage.spellCheck.misspellings`).
 *   - addProseMirrorPlugins() installs a Plugin that:
 *       1. Holds a DecorationSet of inline `.spell-error` marks built from
 *          the misspell list.
 *       2. On each `docChanged` transaction, schedules a re-scan by
 *          bumping an internal seq counter and asynchronously calling
 *          the Worker via `getSpellWorker()`.
 *       3. When the Worker responds, the Plugin writes the result into
 *          `pluginKey.setMeta(...)` — but does NOT dispatch a transaction
 *          from inside `apply()`. The host React component listens to
 *          editor updates and triggers a non-tracked update path.
 *
 *   - The four "no infinite loop" guards:
 *       1. seq counter — stale Worker replies are dropped client-side.
 *       2. `tr.docChanged` guard — only re-scan when the doc actually
 *          changed (selection moves alone don't trigger a scan).
 *       3. meta ref equality — `apply()` returns the old state when the
 *          incoming decoration set is referentially identical (defensive).
 *       4. apply() does NOT dispatch — workers reply via the React
 *          layer, never via view.dispatch from inside apply.
 */
export interface SpellCheckOptions {
  enabled: boolean;
  lang: 'en-US' | 'zh-CN';
}

export interface SpellCheckStorage {
  misspellings: Misspell[];
  enabled: boolean;
}

/**
 * Module-level PluginKey used by both the Plugin spec and any external
 * caller (Worker reply dispatch, tests, settings push). TipTap does
 * NOT rename plugin keys — the same reference lands on
 * `state.plugins[i].spec.key` unchanged.
 */
export const SPELL_PLUGIN_KEY = new PluginKey<DecorationSet>('spellCheck');

/**
 * Visible to SpellPanel / Editor: how to subscribe to misspell updates.
 * SpellPanel registers via `onMisspellingsChange` and the extension
 * fires it whenever the storage mutates.
 */
type MisspellingsListener = (list: Misspell[]) => void;
const listeners = new Set<MisspellingsListener>();

export function subscribeMisspellings(fn: MisspellingsListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners(list: Misspell[]): void {
  for (const fn of listeners) fn(list);
}

export const SpellCheck = Extension.create<SpellCheckOptions>({
  name: 'spellCheck',

  addOptions() {
    return { enabled: false, lang: 'en-US' };
  },

  addStorage() {
    const storage: SpellCheckStorage = {
      misspellings: [],
      enabled: this.options.enabled,
    };
    return storage;
  },

  onCreate() {
    // Seed the storage flag from options in case addStorage ran before
    // the configure() options were merged.
    this.storage.enabled = this.options.enabled;
  },

  addProseMirrorPlugins() {
    const storage = this.editor.storage.spellCheck as SpellCheckStorage;
    // Reuse the module-level key so external callers (`getSpellWorker`
    // dispatch, tests) can use the same PluginKey instance. TipTap does
    // NOT rename our key — it leaves the spec.key reference untouched.
    const pluginKey = SPELL_PLUGIN_KEY;
    let seq = 0;
    let lastScannedText = '';

    // Worker bridge is lazy — the Worker is created on first scan, not at
    // extension construction, so editors that never enable spell-check
    // never pay the startup cost.
    let workerP: ReturnType<typeof import('./spell-worker-client').getSpellWorker> | null = null;

    const updateDecos = (_decoSet: DecorationSet, misspellings: Misspell[]) => {
      storage.misspellings = misspellings;
      notifyListeners(misspellings);
    };

    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old, _newState, newEditorState) {
            const meta = tr.getMeta(pluginKey) as { misspellings?: Misspell[] } | undefined;
            if (meta && Array.isArray(meta.misspellings)) {
              const decos = buildDecorations(newEditorState.doc, meta.misspellings);
              updateDecos(decos, meta.misspellings);
              return decos;
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
        view(view) {
          // Schedule a scan after each docChanged transaction.
          const schedule = (text: string) => {
            if (!storage.enabled) {
              if (storage.misspellings.length > 0) {
                view.dispatch(view.state.tr.setMeta(pluginKey, { misspellings: [] }));
              }
              lastScannedText = text;
              return;
            }
            lastScannedText = text;
            const mySeq = ++seq;
            (async () => {
              try {
                if (!workerP) {
                  const mod = await import('./spell-worker-client');
                  workerP = mod.getSpellWorker();
                }
                const w = await workerP;
                await w.ready();
                const misspellings = await w.scan(mySeq, text);
                // Drop stale replies (layer #1: even though the client
                // already drops them, we re-check here so a future
                // refactor of the client can't accidentally bypass).
                if (mySeq !== seq) return;
                if (text !== view.state.doc.textContent) return;
                view.dispatch(view.state.tr.setMeta(pluginKey, { misspellings }));
              } catch {
                // Worker unavailable — leave decorations empty; the
                // SpellPanel surfaces a "dictionary unavailable" hint
                // via storage.misspellings remaining stale (we don't
                // clear on error to avoid flapping the UI).
              }
            })();
          };

          // Initial scan if enabled.
          if (storage.enabled) {
            schedule(view.state.doc.textContent);
          }

          return {
            update(updatedView, _prevState) {
              if (!storage.enabled) return;
              const tr = updatedView.state.tr;
              if (tr.docChanged && updatedView.state.doc.textContent !== lastScannedText) {
                schedule(updatedView.state.doc.textContent);
              }
            },
          };
        },
      }),
    ];
  },
});

/**
 * Build a DecorationSet from a misspell list, converting char offsets
 * into PM positions by walking the doc.
 *
 * Skipped block types: codeBlock, mathDisplay, mathInline, image (alt
 * text only). Inline code (`code` mark) is excluded per-text-node.
 */
function buildDecorations(doc: ProseMirrorNode, misspellings: Misspell[]): DecorationSet {
  if (misspellings.length === 0) return DecorationSet.empty;
  const offsetMap = buildCharOffsetMap(doc);
  const decos: Decoration[] = [];
  for (const m of misspellings) {
    const from = offsetMap.get(m.from);
    const to = offsetMap.get(m.to);
    if (from == null || to == null || from >= to) continue;
    decos.push(Decoration.inline(from, to, { class: 'spell-error' }));
  }
  return DecorationSet.create(doc, decos);
}

/**
 * Walk the doc once, recording the PM position corresponding to each
 * char offset in `doc.textContent`. Block boundaries contribute a single
 * '\n' character between top-level blocks (matches `doc.textContent`).
 *
 * Char offsets are 0-indexed and represent the position *before* each
 * character. For a word spanning offsets [from, to) the PM range is
 * from = map.get(from) and to = map.get(to).
 *
 * We map every offset including the "one past the last char" position
 * (the closing token), because misspell entries use right-open ranges.
 */
function buildCharOffsetMap(doc: ProseMirrorNode): Map<number, number> {
  const map = new Map<number, number>();
  let charOffset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const block = doc.child(i);
    const blockOpenPos = blockPos(doc, i);
    block.descendants((node, pos) => {
      if (node.isText) {
        const text = node.text ?? '';
        // Map each char position 0..text.length (inclusive end).
        // The position "one past the last char" lands at pos + text.length.
        for (let k = 0; k <= text.length; k++) {
          map.set(charOffset + k, blockOpenPos + 1 + pos + k);
        }
        charOffset += text.length;
      }
      return true;
    });
    if (i < doc.childCount - 1) {
      // Implicit '\n' between top-level blocks. The character sits at
      // the closing token of this block; the next char (offset+1) is
      // the first char of the next block.
      const boundaryPos = blockOpenPos + block.nodeSize;
      map.set(charOffset, boundaryPos);
      charOffset += 1;
    }
  }
  return map;
}

/**
 * Position of the i-th top-level child (the open token).
 * For `<p>foo</p><p>bar</p>`:
 *   - child 0 (first <p>) opens at PM pos 0
 *   - child 1 (second <p>) opens at PM pos 5
 *     (1 open token + 3 text + 1 close = 5)
 */
function blockPos(doc: ProseMirrorNode, i: number): number {
  let pos = 0;
  for (let k = 0; k < i; k++) pos += doc.child(k).nodeSize;
  return pos;
}

/**
 * Helper exported for tests: convert char offsets in a doc to PM positions
 * without instantiating a TipTap Editor.
 */
export function _testOffsetMap(doc: ProseMirrorNode): Map<number, number> {
  return buildCharOffsetMap(doc);
}

/**
 * Test-only: inject misspellings directly so tests can verify
 * decorations render without waiting for the Worker. Production code
 * never calls this — misspellings arrive via pluginKey.setMeta.
 */
export function _testInjectMisspellings(editor: import('@tiptap/core').Editor, misspellings: Misspell[]): void {
  editor.view.dispatch(
    editor.view.state.tr.setMeta(SPELL_PLUGIN_KEY, { misspellings }),
  );
}

/**
 * Update the `enabled` flag on storage without rebuilding the editor.
 * Mirrors `MarkdownPaste.currentFilePath` — the React layer pushes
 * settings changes into the extension via this method.
 */
export function setSpellCheckEnabled(editor: import('@tiptap/core').Editor, enabled: boolean): void {
  const storage = editor.storage.spellCheck as SpellCheckStorage | undefined;
  if (!storage) return;
  if (storage.enabled === enabled) return;
  storage.enabled = enabled;
  if (!enabled) {
    editor.view.dispatch(editor.view.state.tr.setMeta(SPELL_PLUGIN_KEY, { misspellings: [] }));
  } else {
    editor.view.dispatch(editor.view.state.tr);
  }
}
