import { describe, it, expect } from 'vitest';
import { Schema } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { InputRule } from 'prosemirror-inputrules';
import { nodes } from '../schema/nodes';
import { marks } from '../schema/marks';
import { blockRules, inlineRules } from './markdown-input-rules';

const schema = new Schema({ nodes, marks });

type RuleInternal = InputRule & { match: RegExp; handler: any };

function makeState(text: string): EditorState {
  const para = schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);
  const doc = schema.nodes.doc.create(null, para);
  return EditorState.create({ schema, doc, selection: TextSelection.atEnd(doc) });
}

function applyRule(state: EditorState, rule: RuleInternal, text: string): EditorState {
  // The doc has a paragraph wrapper (size 1 at start). The text occupies the
  // first textblock, beginning at offset 1. End is 1 + text.length (inside the
  // paragraph, at the end of text content).
  const match = rule.match.exec(text);
  if (!match) throw new Error(`text "${text}" does not match rule ${rule.match}`);
  const start = 1;
  const end = 1 + text.length;
  const tr = rule.handler(state, match, start, end);
  if (!tr) throw new Error('rule did not produce a transaction');
  return state.apply(tr);
}

describe('markdown input rules', () => {
  it('converts # + space to H1', () => {
    const rule = (blockRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('# '));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('# '), rule!, '# ');
    expect(st.doc.child(0).type.name).toBe('heading');
    expect((st.doc.child(0).attrs as any).level).toBe(1);
  });

  it('converts ## + space to H2', () => {
    const rule = (blockRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('## '));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('## '), rule!, '## ');
    expect(st.doc.child(0).type.name).toBe('heading');
    expect((st.doc.child(0).attrs as any).level).toBe(2);
  });

  it('converts #### + space to H4', () => {
    const rule = (blockRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('#### '));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('#### '), rule!, '#### ');
    expect(st.doc.child(0).type.name).toBe('heading');
    expect((st.doc.child(0).attrs as any).level).toBe(4);
  });

  it('converts **text** to bold', () => {
    const rule = (inlineRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('\\*\\*'));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('**bold**'), rule!, '**bold**');
    const para = st.doc.child(0);
    expect(para.child(0).marks.some((m: any) => m.type.name === 'bold')).toBe(true);
  });

  it('converts *text* to italic (without colliding with bold)', () => {
    const rule = (inlineRules(schema) as RuleInternal[]).find((r) => {
      const s = r.match.source;
      return s.startsWith('(?<!') && !s.includes('_');
    });
    expect(rule).toBeDefined();
    const st = applyRule(makeState('*em*'), rule!, '*em*');
    const para = st.doc.child(0);
    expect(para.child(0).marks.some((m: any) => m.type.name === 'italic')).toBe(true);
  });

  it('converts `code` to code mark', () => {
    const rule = (inlineRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('`'));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('`x`'), rule!, '`x`');
    const para = st.doc.child(0);
    expect(para.child(0).marks.some((m: any) => m.type.name === 'code')).toBe(true);
  });

  it('converts [text](url) to a link', () => {
    const rule = (inlineRules(schema) as RuleInternal[]).find((r) => r.match.toString().includes('\\]\\('));
    expect(rule).toBeDefined();
    const st = applyRule(makeState('[a](https://b)'), rule!, '[a](https://b)');
    const para = st.doc.child(0);
    const linkMark = para.child(0).marks.find((m: any) => m.type.name === 'link');
    expect(linkMark).toBeDefined();
    expect(linkMark!.attrs.href).toBe('https://b');
  });

  it('converts - + space to bullet list', () => {
    const rule = (blockRules(schema) as RuleInternal[]).find((r) => r.match.toString() === '/^[-*+] $/');
    expect(rule).toBeDefined();
    const st = applyRule(makeState('- '), rule!, '- ');
    expect(st.doc.child(0).type.name).toBe('bulletList');
  });
});
