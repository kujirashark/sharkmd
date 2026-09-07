export interface Heading { level: 1 | 2 | 3 | 4; text: string }
export function Outline({ headings }: { headings: Heading[] }) {
  return (
    <ul className="outline">
      {headings.map((h, i) => (
        <li key={i} data-level={h.level}>{h.text}</li>
      ))}
    </ul>
  );
}

export function extractHeadings(doc: any): Heading[] {
  const out: Heading[] = [];
  function walk(node: any) {
    if (node.type === 'heading' && node.attrs?.level) {
      out.push({ level: node.attrs.level, text: collectText(node) });
    }
    node.content?.forEach(walk);
  }
  function collectText(n: any): string {
    if (n.type === 'text') return n.text ?? '';
    return (n.content ?? []).map(collectText).join('');
  }
  walk(doc);
  return out;
}
