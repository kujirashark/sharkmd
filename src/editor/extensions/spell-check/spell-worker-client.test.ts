import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSpellWorker, __resetSpellWorkerForTests } from './spell-worker-client';

/**
 * Mock Worker — the production code uses `new Worker(new URL(...))` which
 * jsdom can't construct. We stub the global so getSpellWorker() exercises
 * the real protocol against an in-memory fake.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  url: string | URL;
  options: WorkerOptions | undefined;
  private listeners: { [k: string]: ((event: Event) => void)[] } = {};
  posted: unknown[] = [];
  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url;
    this.options = options;
    FakeWorker.instances.push(this);
  }
  postMessage(msg: unknown): void {
    this.posted.push(msg);
  }
  addEventListener(type: string, fn: (event: Event) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(): void {
    /* noop */
  }
  terminate(): void {
    FakeWorker.instances = FakeWorker.instances.filter((w) => w !== this);
  }
  /** Test helper — simulate a postMessage from the worker. */
  simulateReply(msg: unknown): void {
    const event = { data: msg } as unknown as Event;
    for (const fn of this.listeners['message'] ?? []) fn(event);
  }
  /** Test helper — simulate an ErrorEvent from the worker. */
  simulateError(message: string): void {
    const ev = { message } as unknown as ErrorEvent;
    for (const fn of this.listeners['error'] ?? []) fn(ev);
  }
}

describe('spell-worker-client', () => {
  beforeEach(() => {
    __resetSpellWorkerForTests();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
  });

  it('initialises the worker lazily and resolves ready()', async () => {
    const apiP = getSpellWorker();
    // First await constructs the Worker.
    await apiP;
    const instance = FakeWorker.instances[0];
    expect(instance).toBeDefined();
    expect(instance.posted[0]).toEqual({ type: 'init', lang: 'en-US' });

    const api = await apiP;
    instance.simulateReply({ type: 'ready' });
    await expect(api.ready()).resolves.toBeUndefined();
  });

  it('scan() posts a scan message and resolves with misspells on reply', async () => {
    const api = await getSpellWorker();
    const instance = FakeWorker.instances[0];
    instance.simulateReply({ type: 'ready' });
    await api.ready();

    const promise = api.scan(7, 'recieve');
    expect(instance.posted.at(-1)).toEqual({ type: 'scan', seq: 7, text: 'recieve' });

    instance.simulateReply({
      type: 'result',
      seq: 7,
      misspells: [{ word: 'recieve', from: 0, to: 7, suggestions: ['receive'] }],
    });
    await expect(promise).resolves.toEqual([
      { word: 'recieve', from: 0, to: 7, suggestions: ['receive'] },
    ]);
  });

  it('drops out-of-order replies (older seq is ignored)', async () => {
    const api = await getSpellWorker();
    const instance = FakeWorker.instances[0];
    instance.simulateReply({ type: 'ready' });
    await api.ready();

    const p1 = api.scan(10, 'first');
    // Simulate a stale older reply arriving first.
    instance.simulateReply({
      type: 'result',
      seq: 5,
      misspells: [{ word: 'old', from: 0, to: 3, suggestions: [] }],
    });
    // Then the matching one arrives.
    instance.simulateReply({
      type: 'result',
      seq: 10,
      misspells: [{ word: 'first', from: 0, to: 5, suggestions: ['firstly'] }],
    });
    await expect(p1).resolves.toEqual([
      { word: 'first', from: 0, to: 5, suggestions: ['firstly'] },
    ]);
  });

  it('rejects ready() when the worker posts an error before ready', async () => {
    const api = await getSpellWorker();
    const instance = FakeWorker.instances[0];
    instance.simulateReply({ type: 'error', message: 'init failed' });
    await expect(api.ready()).rejects.toThrow('init failed');
  });

  it('rejects scan() when the worker posts an error message', async () => {
    const api = await getSpellWorker();
    const instance = FakeWorker.instances[0];
    instance.simulateReply({ type: 'ready' });
    await api.ready();

    const p = api.scan(1, 'x');
    instance.simulateReply({ type: 'error', message: 'oops' });
    await expect(p).rejects.toThrow('oops');
  });

  it('caches the worker across multiple getSpellWorker() calls', async () => {
    const a = await getSpellWorker();
    const b = await getSpellWorker();
    expect(a).toBe(b);
    expect(FakeWorker.instances).toHaveLength(1);
  });
});
