import React from 'react';

interface HeaderMenuProps {
  headerMenu: { column: string; x: number; y: number } | null;
  sortColumn: string;
  setSortColumn: (col: string) => void;
  sortDirection: string;
  setSortDirection: (dir: string) => void;
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
  return (
    <div
      style={{
        position: 'fixed',
        top: headerMenu.y,
        left: headerMenu.x,
        background: 'white',
        border: '1px solid #ccc',
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
      onMouseLeave={() => setHeaderMenu(null)}
    >
      <div
        style={{ padding: '8px 16px', cursor: 'pointer' }}
        onClick={() => {
          setSortColumn(headerMenu.column);
          setSortDirection('asc');
          setHeaderMenu(null);
        }}
      >Sort ascending</div>
      <div
        style={{ padding: '8px 16px', cursor: 'pointer' }}
        onClick={() => {
          setSortColumn(headerMenu.column);
          setSortDirection('desc');
          setHeaderMenu(null);
        }}
      >Sort descending</div>
      {(sortColumn === headerMenu.column) && (
        <div
          style={{ padding: '8px 16px', cursor: 'pointer' }}
          onClick={() => {
            setSortColumn('');
            setSortDirection('');
            setHeaderMenu(null);
          }}
        >Clear sort</div>
      )}
    </div>
  );
};

export default HeaderMenu;
