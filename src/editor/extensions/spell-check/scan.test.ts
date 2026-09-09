import { describe, it, expect } from 'vitest';
import { tokenizeForSpell, scanMisspells } from './scan';

describe('tokenizeForSpell', () => {
  it('returns empty array for empty string', () => {
    expect(tokenizeForSpell('')).toEqual([]);
  });

  it('tokenizes single English word', () => {
    expect(tokenizeForSpell('hello')).toEqual([
      { word: 'hello', from: 0, to: 5 },
    ]);
  });

  it('keeps character offsets stable across punctuation/whitespace', () => {
    const text = 'hello, world!';
    const tokens = tokenizeForSpell(text);
    expect(tokens).toEqual([
      { word: 'hello', from: 0, to: 5 },
      { word: 'world', from: 7, to: 12 },
    ]);
    // sanity: positions point at the actual letters
    expect(text.slice(tokens[0].from, tokens[0].to)).toBe('hello');
    expect(text.slice(tokens[1].from, tokens[1].to)).toBe('world');
  });

  it('preserves Unicode (CJK and accents) as part of a token', () => {
    const tokens = tokenizeForSpell('café résumé');
    expect(tokens.map((t) => t.word)).toEqual(['café', 'résumé']);
    const text = 'café résumé';
    for (const t of tokens) {
      expect(text.slice(t.from, t.to)).toBe(t.word);
    }
  });

  it('treats apostrophe and hyphen as part of a word', () => {
    expect(tokenizeForSpell("don't well-known apple's").map((t) => t.word)).toEqual([
      "don't",
      'well-known',
      "apple's",
    ]);
  });

  it('keeps multi-line offsets accurate', () => {
    const text = 'foo\nbar baz';
    const tokens = tokenizeForSpell(text);
    expect(tokens).toEqual([
      { word: 'foo', from: 0, to: 3 },
      { word: 'bar', from: 4, to: 7 },
      { word: 'baz', from: 8, to: 11 },
    ]);
  });
});

describe('scanMisspells', () => {
  it('returns misspell entries with suggestions capped at 5', () => {
    const text = 'recieve occured';
    const dict = new Map([
      ['recieve', ['receive']],
      ['occured', ['occurred', 'occur']],
    ]);
    const correct = (w: string) => !dict.has(w.toLowerCase());
    const suggest = (w: string) => dict.get(w.toLowerCase()) ?? [];
    const out = scanMisspells(text, correct, suggest);
    expect(out).toHaveLength(2);
    expect(out[0].word).toBe('recieve');
    expect(out[0].suggestions).toEqual(['receive']);
    expect(out[1].word).toBe('occured');
    expect(out[1].suggestions).toEqual(['occurred', 'occur']);
    expect(out[0].from).toBe(0);
    expect(out[0].to).toBe(7);
  });

  it('skips tokens shorter than 2 characters', () => {
    const text = 'a b cd';
    const out = scanMisspells(text, () => false, () => []);
    // tokenizeForSpell drops < 2-char tokens; only 'cd' remains.
    expect(out.map((m) => m.word)).toEqual(['cd']);
  });

  it('skips all-uppercase tokens (likely acronyms)', () => {
    const text = 'NASA API rulez';
    const correct = (w: string) => w !== 'rulez';
    const suggest = (w: string) => (w === 'rulez' ? ['rules'] : []);
    const out = scanMisspells(text, correct, suggest);
    expect(out.map((m) => m.word)).toEqual(['rulez']);
  });

  it('skips pure-digit tokens', () => {
    const text = '123 abc 45';
    const out = scanMisspells(text, () => false, () => []);
    // 'abc' is a single word but length 3 → still considered.
    expect(out.map((m) => m.word)).toEqual(['abc']);
  });

  it('returns empty suggestions array when dictionary has none', () => {
    const text = 'asdf';
    const out = scanMisspells(text, () => false, () => []);
    expect(out).toEqual([{ word: 'asdf', from: 0, to: 4, suggestions: [] }]);
  });

  it('caps suggestions at 5 entries', () => {
    const text = 'xx';
    const suggest = () => ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const out = scanMisspells(text, () => false, suggest);
    expect(out[0].suggestions).toHaveLength(5);
  });

  it('coexists with surrounding correct words without affecting them', () => {
    const text = 'this recieve is occured';
    const dict = new Map([
      ['recieve', ['receive']],
      ['occured', ['occurred']],
    ]);
    const correct = (w: string) => !dict.has(w);
    const suggest = (w: string) => dict.get(w) ?? [];
    const out = scanMisspells(text, correct, suggest);
    expect(out.map((m) => m.word)).toEqual(['recieve', 'occured']);
  });
});
