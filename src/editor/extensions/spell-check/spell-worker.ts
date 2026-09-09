/// <reference lib="webworker" />
/**
 * Web Worker entry for spell checking.
 *
 * Protocol:
 *   → init { lang }         loads the dictionary and posts `ready`
 *   → scan  { seq, tokens } returns { seq, misspells }
 *   ← ready / result / error
 *
 * The Worker keeps a single nspell instance and serves all `scan`
 * requests sequentially. It does NOT maintain its own seq counter — the
 * main thread (Client) tags each request with a monotonic seq and the
 * Client drops out-of-order replies so a slow old scan can't overwrite a
 * newer one. This is layer #1 of the "no infinite loop" protection
 * documented in `spell-worker-client.ts`.
 *
 * Supported dictionaries are wired up via `dictionaries/index.ts` which
 * returns Vite `?url` URLs for the `.aff` / `.dic` files.
 */
import nspell from 'nspell';
import type { Misspell, Token } from './scan';
import { tokenizeForSpell, scanMisspells } from './scan';
import { getDictionary } from './dictionaries';

type IncomingMessage =
  | { type: 'init'; lang: string }
  | { type: 'scan'; seq: number; text: string };

type OutgoingMessage =
  | { type: 'ready' }
  | { type: 'result'; seq: number; misspells: Misspell[] }
  | { type: 'error'; message: string };

// We hold a single nspell instance per worker; re-init replaces it.
let spell: ReturnType<typeof nspell> | null = null;

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(msg: OutgoingMessage): void {
  ctx.postMessage(msg);
}

async function init(lang: string): Promise<void> {
  const dict = await getDictionary(lang);
  spell = nspell(dict);
  post({ type: 'ready' });
}

function scan(seq: number, text: string): void {
  if (!spell) {
    post({ type: 'error', message: 'Worker not initialised — call init first' });
    return;
  }
  try {
    const tokens: Token[] = tokenizeForSpell(text);
    const misspells = scanMisspells(
      text,
      (w) => spell!.correct(w),
      (w) => spell!.suggest(w),
    );
    // Tokens aren't returned — they're an internal step. The Plugin only
    // needs the final misspells. We log tokens count to ease debugging.
    if (misspells.length > 0) {
      // eslint-disable-next-line no-console
      console.debug('[spell-worker] scanned', tokens.length, 'tokens,', misspells.length, 'misspells');
    }
    post({ type: 'result', seq, misspells });
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
}

ctx.addEventListener('message', (event: MessageEvent<IncomingMessage>) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'init') {
    init(data.lang).catch((e: unknown) => {
      post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
    });
    return;
  }
  if (data.type === 'scan') {
    scan(data.seq, data.text);
    return;
  }
});
