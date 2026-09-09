declare module 'nspell' {
  interface NspellInstance {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): void;
    remove(word: string): void;
    personal(dict: { aff: Uint8Array; dic: Uint8Array }): void;
  }
  interface Dictionary {
    aff: Uint8Array;
    dic: Uint8Array;
  }
  function nspell(dict: Dictionary | Dictionary[]): NspellInstance;
  export default nspell;
}
