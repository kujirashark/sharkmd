/**
 * Pure functions for tokenizing text and detecting misspellings.
 *
 * The pipeline is intentionally split into two stages:
 *
 *   1. `tokenizeForSpell` walks the input with the Unicode-aware regex
 *      `\p{L}[\p{L}'-]*` so accented characters and CJK glyphs are treated
 *      as ordinary letters (nspell's English dictionary does not understand
 *      CJK as a word boundary, but skipping per-script is the caller's job).
 *   2. `scanMisspells` consults the injected `correct` / `suggest` callbacks
 *      to flag tokens. Keeping these as injected functions means the test
 *      suite can run without a dictionary and the worker code can pass in
 *      nspell-backed callbacks.
 *
 * Skipped categories:
 *   - tokens shorter than 2 chars (likely abbreviations / list markers)
 *   - all-uppercase tokens (likely acronyms / brand names)
 *   - pure-digit tokens (handled by the `\p{L}` prefix, but kept here as
 *     a documented invariant in case the regex is ever loosened)
 */

export interface Token {
  word: string;
  from: number;
  to: number;
}

export interface Misspell {
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

/** Matches a word: Unicode letter followed by letters / apostrophes / hyphens. */
const WORD_RE = /\p{L}[\p{L}'-]*/gu;

const MAX_SUGGESTIONS = 5;

export function tokenizeForSpell(text: string): Token[] {
  const out: Token[] = [];
  if (!text) return out;
  // We collect each match with its source slice so `from`/`to` always
  // point at the exact substring (no off-by-one between regex indices and
  // String.prototype.slice semantics).
  for (const match of text.matchAll(WORD_RE)) {
    const word = match[0];
    if (word.length < 2) continue;
    // Strip apostrophes / hyphens before the all-caps check so contractions
    // like "DON'T" aren't mistaken for an acronym.
    const letters = word.replace(/['-]/g, '');
    if (letters.length < 1) continue;
    if (letters === letters.toUpperCase() && /[A-Z]/.test(letters)) continue;
    out.push({ word, from: match.index ?? 0, to: (match.index ?? 0) + word.length });
  }
  return out;
}

/**
 * Run `correct` / `suggest` over every token from `text` and collect
 * misspell entries.
 *
 * `correct` should return true when the word is fine; `suggest` returns
 * zero-or-more replacement candidates (most useful first; we cap at 5).
 *
 * Suggestions are sliced (not mutated) — callers can reuse the underlying
 * array safely.
 */
export function scanMisspells(
  text: string,
  correct: (w: string) => boolean,
  suggest: (w: string) => string[],
): Misspell[] {
  const out: Misspell[] = [];
  for (const t of tokenizeForSpell(text)) {
    if (correct(t.word)) continue;
    const raw = suggest(t.word) ?? [];
    const suggestions = raw.slice(0, MAX_SUGGESTIONS);
    out.push({ word: t.word, from: t.from, to: t.to, suggestions });
  }
  return out;
}
