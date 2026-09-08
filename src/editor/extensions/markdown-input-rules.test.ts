import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { InputRule } from '@tiptap/core';
import { nodes } from '../schema/nodes';
import { marks } from '../schema/marks';
import { blockRules, inlineRules } from './markdown-input-rules';

const schema = new Schema({ nodes, marks });

function makeState(text: string): EditorState {
  const para = schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);
  const doc = schema.nodes.doc.create(null, para);
  return EditorState.create({ schema, doc, selection: TextSelection.atEnd(doc) });
}

/**
 * Find a rule whose regex source is identical to `expected.source`.
 * Tests pin each rule's exact regex to catch accidental rewrites —
 * the old `prosemirror-inputrules` API used `.match` and broke TipTap's
 * runtime, so we want a tight assertion here.
 */
function findRuleBySource(rules: InputRule[], expected: RegExp): InputRule | undefined {
  return rules.find((r) => r.find instanceof RegExp && (r.find as RegExp).source === expected.source);
}

describe('markdown input rules', () => {
  describe('block rules', () => {
    it('# + space → heading', () => {
      const rule = findRuleBySource(blockRules(schema), /^(#{1,6}) $/);
      expect(rule).toBeDefined();
    });

    it('- + space → bullet list', () => {
      const rule = findRuleBySource(blockRules(schema), /^[-*+] $/);
      expect(rule).toBeDefined();
    });

    it('1. + space → ordered list', () => {
      const rule = findRuleBySource(blockRules(schema), /^1\. $/);
      expect(rule).toBeDefined();
    });

    it('> + space → blockquote', () => {
      const rule = findRuleBySource(blockRules(schema), /^> $/);
      expect(rule).toBeDefined();
    });

    it('``` → code block', () => {
      const rule = findRuleBySource(blockRules(schema), /^```$/);
      expect(rule).toBeDefined();
    });

    it('--- → horizontal rule', () => {
      const rule = findRuleBySource(blockRules(schema), /^---$/);
      expect(rule).toBeDefined();
    });
  });

  describe('inline rules', () => {
    it('**text** → bold', () => {
      const rule = findRuleBySource(inlineRules(schema), /\*\*([^*]+)\*\*$/);
      expect(rule).toBeDefined();
    });

    it('*text* → italic (lookbehind)', () => {
      const rule = findRuleBySource(inlineRules(schema), /(?<!\*)\*([^*]+)\*(?!\*)$/);
      expect(rule).toBeDefined();
    });

    it('_text_ → italic (underscore)', () => {
      const rule = findRuleBySource(inlineRules(schema), /_([^_]+)_$/);
      expect(rule).toBeDefined();
    });

    it('~~text~~ → strike', () => {
      const rule = findRuleBySource(inlineRules(schema), /~~([^~]+)~~$/);
      expect(rule).toBeDefined();
    });

    it('`text` → code mark', () => {
      const rule = findRuleBySource(inlineRules(schema), /`([^`]+)`$/);
      expect(rule).toBeDefined();
    });

    it('[text](url) → link', () => {
      const rule = findRuleBySource(inlineRules(schema), /\[([^\]]+)\]\(([^)]+)\)$/);
      expect(rule).toBeDefined();
    });
  });

  // The handler bodies wrap TipTap's chain() — they're hard to exercise
  // without a live editor. The end-to-end "type # then space → heading"
  // behaviour is covered by `Editor.enter-bug.test.tsx`, which dispatches
  // real keydown events against the rendered editor.

  describe('shape', () => {
    it('every rule has a callable handler', () => {
      const all = [...blockRules(schema), ...inlineRules(schema)];
      expect(all.length).toBeGreaterThan(0);
      for (const r of all) {
        expect(typeof r.handler).toBe('function');
      }
    });

    // Regression: the old prosemirror-inputrules API stored the regex
    // in `.match`, which broke TipTap's inputRulesPlugin (it reads
    // `.find`). If any rule still has `.match` instead of `.find`, it
    // throws "find is not a function" on every keydown — see the
    // Editor.enter-bug.test.tsx regression for the live proof.
    it('all rules reference TipTap InputRule.find, not prosemirror InputRule.match', () => {
      const all = [...blockRules(schema), ...inlineRules(schema)];
      for (const r of all) {
        expect(r.find).toBeDefined();
        // @ts-expect-error — `.match` was the old field
        expect(r.match).toBeUndefined();
      }
    });
  });
});

describe('markdown input rules / schema smoke', () => {
  it('makeState builds without throwing', () => {
    expect(() => makeState('hello world')).not.toThrow();
  });
});
