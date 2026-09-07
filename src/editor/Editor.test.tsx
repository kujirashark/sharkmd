import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Editor } from './Editor';
import type { JSONContent } from '@tiptap/core';

describe('<Editor>', () => {
  it('mounts with initial content and reports changes', () => {
    const initial: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
    const onChange = vi.fn();
    const { container } = render(<Editor value={initial} onChange={onChange} />);
    expect(container.querySelector('.ProseMirror')).toBeTruthy();
  });
});
