/**
 * Main-thread singleton proxy around the spell-check Worker.
 *
 * Why a singleton?
 *   - Worker startup is expensive (parsing the nspell + dictionary bundle
 *     takes ~50–150 ms). We share one instance across every Editor and
 *     every Tauri window reload.
 *   - Editors come and go as the user opens / closes tabs; the underlying
 *     Worker survives all of them.
 *
 * Why pass `text` instead of `tokens` to scan()?
 *   - v0.4 keeps the tokeniser inside the Worker so we don't pay a
 *     serialization round-trip on every keystroke for tokens that will be
 *     dropped anyway. The Plugin sends `doc.textContent`; the Worker
 *     runs tokenize + scan + dictionary lookup and returns misspellings
 *     only.
 *
 * Sequence / staleness protection:
 *   - Every `scan` is tagged with a monotonic `seq`. Replies carry the
 *     same seq; the Client rejects any reply whose seq doesn't match the
 *     latest request. This is the first of four layers of "no infinite
 *     loop" protection; the rest live in the TipTap plugin.
 */
import type { Misspell } from './scan';

export interface SpellWorker {
  /** Ensure the underlying Worker is ready (initialised with a dictionary). */
  ready(): Promise<void>;
  /** Run a scan over the given text. Returns misspellings for the latest seq only. */
  scan(seq: number, text: string): Promise<Misspell[]>;
  /** Tear down the Worker (used by tests; production code never calls this). */
  destroy(): void;
}

interface InitMessage {
  type: 'ready';
}
interface ResultMessage {
  type: 'result';
  seq: number;
  misspells: Misspell[];
}
interface ErrorMessage {
  type: 'error';
  message: string;
}
type WorkerOutMessage = InitMessage | ResultMessage | ErrorMessage;

let cached: Promise<SpellWorker> | null = null;

/**
 * Returns (and lazily creates) the singleton Worker proxy.
 *
 * Vite handles the `new Worker(new URL(...))` syntax natively, producing
 * a code-split Worker bundle in the build output.
 */
export function getSpellWorker(): Promise<SpellWorker> {
  if (cached) return cached;
  cached = (async (): Promise<SpellWorker> => {
    const worker = new Worker(new URL('./spell-worker.ts', import.meta.url), {
      type: 'module',
      name: 'sharkmd-spell',
    });

    // Resolves on the first 'ready' message after init.
    let readyResolve: (() => void) | null = null;
    let readyReject: ((e: Error) => void) | null = null;
    let readyPromise: Promise<void> = Promise.resolve();
    let lastSeq = -1;
    let pending: { seq: number; resolve: (m: Misspell[]) => void; reject: (e: Error) => void } | null = null;

    worker.addEventListener('message', (event: MessageEvent<WorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'ready') {
        if (readyResolve) {
          readyResolve();
          readyResolve = null;
          readyReject = null;
        }
        return;
      }
      if (msg.type === 'error') {
        if (readyReject) {
          readyReject(new Error(msg.message));
          readyResolve = null;
          readyReject = null;
          return;
        }
        if (pending) {
          pending.reject(new Error(msg.message));
          pending = null;
        }
        return;
      }
      if (msg.type === 'result') {
        // Drop out-of-order replies — a slower older scan must not
        // overwrite a newer one (the tip-tap plugin would then dispatch
        // a stale decoration set).
        if (msg.seq !== lastSeq) return;
        if (pending) {
          pending.resolve(msg.misspells);
          pending = null;
        }
      }
    });

    // If the Worker crashes at startup, surface it through `ready()` so
    // the UI can show a fallback message instead of hanging forever.
    worker.addEventListener('error', (event: ErrorEvent) => {
      const err = new Error(event.message || 'spell worker crashed');
      if (readyReject) {
        readyReject(err);
        readyResolve = null;
        readyReject = null;
      }
      if (pending) {
        pending.reject(err);
        pending = null;
      }
    });

    readyPromise = new Promise<void>((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
      worker.postMessage({ type: 'init', lang: 'en-US' });
    });

    const api: SpellWorker = {
      ready: () => readyPromise,
      scan(seq, text) {
        lastSeq = seq;
        return new Promise<Misspell[]>((resolve, reject) => {
          pending = { seq, resolve, reject };
          worker.postMessage({ type: 'scan', seq, text });
        });
      },
      destroy() {
        worker.terminate();
        cached = null;
      },
    };

    return api;
  })();
  return cached;
}

/**
 * Test-only hook: drops the cached singleton so the next call rebuilds it.
 * Production code never needs this.
 */
export function __resetSpellWorkerForTests(): void {
  cached = null;
}
