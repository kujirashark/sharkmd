export interface Heading { level: 1 | 2 | 3 | 4; text: string; pos?: number }

export interface OutlineProps {
  headings: Heading[];
  onItemClick?: (heading: Heading, index: number) => void;
}

export function Outline({ headings, onItemClick }: OutlineProps) {
  if (headings.length === 0) {
    return (
      <>
        <div className="outline-header">大纲</div>
        <div className="empty">无标题</div>
      </>
    );
  }
  return (
    <>
      <div className="outline-header">大纲 ({headings.length})</div>
      <ul className="outline">
        {headings.map((h, i) => (
          <li
            key={i}
            data-level={h.level}
            title={h.text}
            onClick={() => onItemClick?.(h, i)}
            style={{ cursor: onItemClick ? 'pointer' : 'default' }}
          >
            {h.text}
          </li>
        ))}
      </ul>
    </>
  );
}

export function extractHeadings(doc: any): Heading[] {
  const out: Heading[] = [];
  let textOffset = 0;
  function walk(node: any) {
    if (node.type === 'heading' && node.attrs?.level) {
      out.push({ level: node.attrs.level, text: collectText(node), pos: textOffset });
    }
    if (node.type === 'text' && typeof node.text === 'string') {
      textOffset += node.text.length;
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
