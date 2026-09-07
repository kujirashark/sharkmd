export const marks = {
  bold: {
    parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
    toDOM: () => ['strong', 0] as const,
  },
  italic: {
    parseDOM: [{ tag: 'em' }, { tag: 'i' }],
    toDOM: () => ['em', 0] as const,
  },
  strike: {
    parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
    toDOM: () => ['s', 0] as const,
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', 0] as const,
  },
  link: {
    attrs: { href: {}, title: { default: null } },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs: (dom: any) => ({
          href: dom.getAttribute('href'),
          title: dom.getAttribute('title'),
        }),
      },
    ],
    toDOM: (mark: any) => ['a', { href: mark.attrs.href, title: mark.attrs.title }, 0] as const,
  },
};
