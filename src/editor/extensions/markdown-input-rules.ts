import { Extension, InputRule } from '@tiptap/core';
import type { Schema } from 'prosemirror-model';

/**
 * Markdown auto-format rules — `# ` → H1, `**text**` → bold, etc.
 *
 * Implementation note: this file uses TipTap's `InputRule` (from
 * `@tiptap/core`), NOT prosemirror-inputrules' `InputRule`. The two have
 * different field names — TipTap's expects `{ find, handler }` while
 * prosemirror's is `{ match, handler }` — and TipTap's inputRulesPlugin
 * reads `rule.find` at runtime. Mixing them caused a silent
 * `find is not a function` TypeError on every keydown, which is why
 * typing Enter / `#` / `**` did nothing in the editor until the
 * real-keydown regression test surfaced it.
 *
 * The handler signature is TipTap's: `({ state, range, match, chain })`
 * and mutates `state.tr` directly. Returning `null` aborts the rule,
 * returning anything else lets the plugin dispatch the transaction.
 */

type RuleSet = (schema: Schema) => InputRule[];

function headingRule(schema: Schema, level: number): InputRule {
  return new InputRule({
    find: new RegExp(`^(#{1,6}) $`),
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const hashes = match[1] ?? '';
      const lvl = Math.min(4, Math.max(1, hashes.length));
      if (lvl !== level) return null;
      const $start = state.doc.resolve(range.from);
      const blockRange = $start.blockRange();
      if (!blockRange) return null;
      tr.delete(range.from, range.to);
      tr.setBlockType(blockRange.start, blockRange.end, schema.nodes.heading!, { level });
    },
  });
}

export const blockRules: RuleSet = (schema) => {
  const headingRules: InputRule[] = [];
  for (let level = 1; level <= 4; level++) {
    headingRules.push(headingRule(schema, level));
  }
  return [
    ...headingRules,
    new InputRule({
      find: /^[-*+] $/,
      handler: ({ state, range }) => {
        const tr = state.tr;
        const $start = state.doc.resolve(range.from);
        const blockRange = $start.blockRange();
        if (!blockRange) return null;
        tr.delete(range.from, range.to);
        tr.wrap(blockRange, [{ type: schema.nodes.bulletList! }]);
      },
    }),
    new InputRule({
      find: /^1\. $/,
      handler: ({ state, range }) => {
        const tr = state.tr;
        const $start = state.doc.resolve(range.from);
        const blockRange = $start.blockRange();
        if (!blockRange) return null;
        tr.delete(range.from, range.to);
        tr.wrap(blockRange, [{ type: schema.nodes.orderedList!, attrs: { order: 1 } }]);
      },
    }),
    new InputRule({
      find: /^> $/,
      handler: ({ state, range }) => {
        const tr = state.tr;
        const $start = state.doc.resolve(range.from);
        const blockRange = $start.blockRange();
        if (!blockRange) return null;
        tr.delete(range.from, range.to);
        tr.wrap(blockRange, [{ type: schema.nodes.blockquote! }]);
      },
    }),
    new InputRule({
      find: /^```$/,
      handler: ({ state, range }) => {
        const tr = state.tr;
        const $start = state.doc.resolve(range.from);
        const blockRange = $start.blockRange();
        if (!blockRange) return null;
        tr.delete(range.from, range.to);
        tr.setBlockType(blockRange.start, blockRange.end, schema.nodes.codeBlock!, { language: null });
      },
    }),
    new InputRule({
      find: /^---$/,
      handler: ({ state, range }) => {
        const tr = state.tr;
        const $start = state.doc.resolve(range.from);
        const blockRange = $start.blockRange();
        if (!blockRange) return null;
        tr.delete(range.from, range.to);
        tr.replaceWith(blockRange.start, blockRange.end, schema.nodes.horizontalRule!.create());
      },
    }),
  ];
};

export const inlineRules: RuleSet = (schema) => [
  new InputRule({
    find: /\*\*([^*]+)\*\*$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const node = schema.text(text, [schema.marks.bold!.create()]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
  new InputRule({
    find: /(?<!\*)\*([^*]+)\*(?!\*)$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const node = schema.text(text, [schema.marks.italic!.create()]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
  new InputRule({
    find: /_([^_]+)_$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const node = schema.text(text, [schema.marks.italic!.create()]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
  new InputRule({
    find: /~~([^~]+)~~$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const node = schema.text(text, [schema.marks.strike!.create()]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
  new InputRule({
    find: /`([^`]+)`$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const node = schema.text(text, [schema.marks.code!.create()]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
  new InputRule({
    find: /\[([^\]]+)\]\(([^)]+)\)$/,
    handler: ({ state, range, match }) => {
      const tr = state.tr;
      const text = match[1] ?? '';
      const href = match[2] ?? '';
      const node = schema.text(text, [schema.marks.link!.create({ href, title: null })]);
      tr.replaceWith(range.from, range.to, node);
    },
  }),
];

export const MarkdownInputRules = Extension.create({
  name: 'markdownInputRules',
  addInputRules() {
    return [
      ...blockRules(this.editor.schema),
      ...inlineRules(this.editor.schema),
    ];
  },
});
