import React from 'react';
import DropdownMenu from '../components/DropdownMenu';
import { SortDirection } from '../api';

interface HeaderMenuProps {
  headerMenu: { column: string; x: number; y: number } | null;
  sortColumn: string;
  setSortColumn: (col: string) => void;
  sortDirection: SortDirection;
  setSortDirection: (dir: SortDirection) => void;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
}

const HeaderMenu: React.FC<HeaderMenuProps> = ({
  headerMenu,
  sortColumn,
  setSortColumn,
  sortDirection,
  setSortDirection,
  setHeaderMenu,
}) => {
  if (!headerMenu) return null;
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: headerMenu.y,
    left: headerMenu.x,
    zIndex: 1000,
  };
  return (
    <div style={menuStyle} onMouseLeave={() => setHeaderMenu(null)}>
      <DropdownMenu>
        <div
          style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => {
            setSortColumn(headerMenu.column);
            setSortDirection('asc');
            setHeaderMenu(null);
          }}
        >
          {sortColumn === headerMenu.column && sortDirection === 'asc' && (
            <span style={{ marginRight: 8 }}>✔️</span>
          )}
          Sort ascending
        </div>
        <div
          style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => {
            setSortColumn(headerMenu.column);
            setSortDirection('desc');
            setHeaderMenu(null);
          }}
        >
          {sortColumn === headerMenu.column && sortDirection === 'desc' && (
            <span style={{ marginRight: 8 }}>✔️</span>
          )}
          Sort descending
        </div>
        {(sortColumn === headerMenu.column) && (
          <div
            style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => {
              setSortColumn('');
              setSortDirection('');
              setHeaderMenu(null);
            }}
          >
            <span style={{ width: 24, display: 'inline-block' }}></span>
            Clear sort
          </div>
        )}
      </DropdownMenu>
    </div>
  );
};

export default HeaderMenu;
