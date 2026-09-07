import { describe, it, expect, beforeEach } from 'vitest';
import { useTabsStore } from './store';

describe('tabs store', () => {
  beforeEach(() => useTabsStore.setState({ tabs: [], activeId: null }));

  it('adds tab and sets active', () => {
    const id = useTabsStore.getState().addTab({
      path: '/a.md', title: 'a', content: { type: 'doc' }, mtimeMs: 0,
    });
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeId).toBe(id);
  });

  it('same path reuses tab', () => {
    const id1 = useTabsStore.getState().addTab({ path: '/a.md', title: 'a', content: { type: 'doc' }, mtimeMs: 0 });
    const id2 = useTabsStore.getState().addTab({ path: '/a.md', title: 'a', content: { type: 'doc' }, mtimeMs: 0 });
    expect(id1).toBe(id2);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it('closeTab moves active to next', () => {
    const a = useTabsStore.getState().addTab({ path: '/a.md', title: 'a', content: { type: 'doc' }, mtimeMs: 0 });
    useTabsStore.getState().addTab({ path: '/b.md', title: 'b', content: { type: 'doc' }, mtimeMs: 0 });
    useTabsStore.getState().closeTab(a);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeId).not.toBeNull();
  });

  it('updateContent marks dirty', () => {
    const id = useTabsStore.getState().addTab({ path: '/a.md', title: 'a', content: { type: 'doc' }, mtimeMs: 0 });
    useTabsStore.getState().updateContent(id, { type: 'doc', content: [{ type: 'paragraph' }] });
    expect(useTabsStore.getState().tabs[0].dirty).toBe(true);
  });
});
