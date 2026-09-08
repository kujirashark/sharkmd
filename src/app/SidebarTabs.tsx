import type { RefObject } from 'react';
import { FileTree } from '../sidebar/FileTree';
import { Outline, type Heading } from '../sidebar/Outline';
import { AssetsPanel } from '../sidebar/AssetsPanel';
import { SearchPanel, type SearchPanelHandle } from '../sidebar/SearchPanel';
import { useT } from '../i18n/use-translation';

export type SidebarTab = 'files' | 'outline' | 'assets' | 'search';

export interface SidebarTabsProps {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  rootPath: string;
  headings: Heading[];
  onOpen: (path: string, jumpTo?: { line: number; col: number }) => void;
  onCreate?: (path: string) => void;
  onOutlineClick?: (heading: Heading, index: number) => void;
  activeFilePath: string | null;
  onInsertAsset: (markdown: string) => void;
  /**
   * Imperative ref for the SearchPanel. The parent owns this ref
   * (`useRef<SearchPanelHandle>(null)`) and uses it from the
   * Ctrl+Shift+F shortcut to focus the search input after switching
   * to the search tab.
   */
  searchPanelRef: RefObject<SearchPanelHandle>;
}

export function SidebarTabs({
  active, onChange, rootPath, headings, onOpen, onCreate, onOutlineClick,
  activeFilePath, onInsertAsset, searchPanelRef,
}: SidebarTabsProps) {
  const t = useT();
  return (
    <>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${active === 'files' ? 'active' : ''}`}
          onClick={() => onChange('files')}
        >
          {t('sidebar.files')}
        </button>
        <button
          className={`sidebar-tab ${active === 'outline' ? 'active' : ''}`}
          onClick={() => onChange('outline')}
        >
          {t('sidebar.outline')}
        </button>
        <button
          className={`sidebar-tab ${active === 'assets' ? 'active' : ''}`}
          onClick={() => onChange('assets')}
        >
          {t('sidebar.assets')}
        </button>
        <button
          className={`sidebar-tab ${active === 'search' ? 'active' : ''}`}
          onClick={() => onChange('search')}
        >
          {t('sidebar.search')}
        </button>
      </div>
      {active === 'files' && (
        <FileTree rootPath={rootPath} onOpen={onOpen} onCreate={onCreate} />
      )}
      {active === 'outline' && (
        <Outline headings={headings} onItemClick={onOutlineClick} />
      )}
      {active === 'assets' && (
        <AssetsPanel filePath={activeFilePath} onInsert={onInsertAsset} />
      )}
      {active === 'search' && (
        <SearchPanel rootPath={rootPath} onOpen={onOpen} ref={searchPanelRef} />
      )}
    </>
  );
}
