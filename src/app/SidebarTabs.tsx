import { FileTree } from '../sidebar/FileTree';
import { Outline, type Heading } from '../sidebar/Outline';
import { AssetsPanel } from '../sidebar/AssetsPanel';

export type SidebarTab = 'files' | 'outline' | 'assets';

export interface SidebarTabsProps {
  active: SidebarTab;
  onChange: (tab: SidebarTab) => void;
  rootPath: string;
  headings: Heading[];
  onOpen: (path: string) => void;
  onCreate?: (path: string) => void;
  onOutlineClick?: (heading: Heading, index: number) => void;
  activeFilePath: string | null;
  onInsertAsset: (markdown: string) => void;
}

export function SidebarTabs({
  active, onChange, rootPath, headings, onOpen, onCreate, onOutlineClick,
  activeFilePath, onInsertAsset,
}: SidebarTabsProps) {
  return (
    <>
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${active === 'files' ? 'active' : ''}`}
          onClick={() => onChange('files')}
        >
          文件
        </button>
        <button
          className={`sidebar-tab ${active === 'outline' ? 'active' : ''}`}
          onClick={() => onChange('outline')}
        >
          大纲
        </button>
        <button
          className={`sidebar-tab ${active === 'assets' ? 'active' : ''}`}
          onClick={() => onChange('assets')}
        >
          图片
        </button>
      </div>
      {active === 'files' ? (
        <FileTree rootPath={rootPath} onOpen={onOpen} onCreate={onCreate} />
      ) : active === 'outline' ? (
        <Outline headings={headings} onItemClick={onOutlineClick} />
      ) : (
        <AssetsPanel filePath={activeFilePath} onInsert={onInsertAsset} />
      )}
    </>
  );
}
