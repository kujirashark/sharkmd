import { Extension } from '@tiptap/core';
import { InputRule, wrappingInputRule } from 'prosemirror-inputrules';
import type { Schema } from 'prosemirror-model';

type RuleSet = (schema: Schema) => InputRule[];

export const blockRules: RuleSet = (schema) => {
  const rules: InputRule[] = [];
  for (let level = 1; level <= 4; level++) {
    const hashes = '#'.repeat(level);
    rules.push(
      new InputRule(new RegExp(`^${hashes} $`), (state, _match, start, end) => {
        const { tr } = state;
        tr.delete(start, end);
        const headingType = schema.nodes.heading!;
        const $start = tr.doc.resolve(tr.mapping.map(start));
        const range = $start.blockRange();
        if (range) tr.setBlockType(range.start, range.end, headingType, { level });
        return tr;
      }),
    );
  }
  rules.push(
    wrappingInputRule(/^[-*+] $/, schema.nodes.bulletList!, () => ({})),
  );
  rules.push(
    wrappingInputRule(
      /^1\. $/,
      schema.nodes.orderedList!,
      () => ({ order: 1 }),
    ),
  );
  rules.push(
    new InputRule(/^> $/, (state, _match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      const $start = tr.doc.resolve(tr.mapping.map(start));
      const range = $start.blockRange();
      if (range) tr.wrap(range, [{ type: schema.nodes.blockquote! }]);
      return tr;
    }),
  );
  rules.push(
    new InputRule(/^```$/, (state, _match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      const $start = tr.doc.resolve(tr.mapping.map(start));
      const range = $start.blockRange();
      if (range) tr.setBlockType(range.start, range.end, schema.nodes.codeBlock!, { language: null });
      return tr;
    }),
  );
  rules.push(
    new InputRule(/^---$/, (state, _match, start, end) => {
      const { tr } = state;
      tr.delete(start, end);
      // horizontalRule is not a textblock; replace the current paragraph.
      const $start = tr.doc.resolve(tr.mapping.map(start));
      const range = $start.blockRange();
      if (range) {
        tr.replaceWith(range.start, range.end, schema.nodes.horizontalRule!.create());
      }
      return tr;
    }),
  );
  return rules;
};

export const inlineRules: RuleSet = (schema) => [
  new InputRule(/\*\*([^*]+)\*\*$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(match[1], [schema.marks.bold!.create()]));
    return tr;
  }),
  new InputRule(/(?<!\*)\*([^*]+)\*(?!\*)$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(match[1], [schema.marks.italic!.create()]));
    return tr;
  }),
  new InputRule(/_([^_]+)_$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(match[1], [schema.marks.italic!.create()]));
    return tr;
  }),
  new InputRule(/~~([^~]+)~~$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(match[1], [schema.marks.strike!.create()]));
    return tr;
  }),
  new InputRule(/`([^`]+)`$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(start, end, schema.text(match[1], [schema.marks.code!.create()]));
    return tr;
  }),
  new InputRule(/\[([^\]]+)\]\(([^)]+)\)$/, (state, match, start, end) => {
    const tr = state.tr;
    tr.replaceWith(
      start,
      end,
      schema.text(match[1], [schema.marks.link!.create({ href: match[2], title: null })]),
    );
    return tr;
  }),
];

// TipTap's addInputRules expects TipTap InputRule[]; our factories return
// prosemirror-inputrules' InputRule[]. The two share a compatible handler
// signature (state, match, start, end) — cast at the boundary so callers get
// a single registry without duplicating rule definitions.
export const MarkdownInputRules = Extension.create({
  name: 'markdownInputRules',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addInputRules(this: any) {
    return [
      ...blockRules(this.editor.schema),
      ...inlineRules(this.editor.schema),
    ] as any;
  },
} as any);
