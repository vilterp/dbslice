import React from 'react';

type SortDirection = 'asc' | 'desc' | '';

interface TableHeaderProps {
  columns: string[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({ columns, sortColumn, sortDirection, headerMenu, setHeaderMenu }) => {
  return (
    <>
      {columns.map(column => (
        <th
          key={column}
          style={{
            position: 'relative',
            userSelect: 'none',
            background: headerMenu?.column === column ? '#f0f0f0' : undefined,
            transition: 'background 0.15s',
          }}
          onMouseEnter={() => setHeaderMenu(headerMenu && headerMenu.column === column ? headerMenu : null)}
          onMouseLeave={() => setHeaderMenu(headerMenu && headerMenu.column === column ? null : headerMenu)}
        >
          <span style={{ verticalAlign: 'middle' }}>{column}
            {sortColumn === column && sortDirection === 'asc' && <span style={{ marginLeft: 4 }}>▲</span>}
            {sortColumn === column && sortDirection === 'desc' && <span style={{ marginLeft: 4 }}>▼</span>}
          </span>
          <button
            style={{
              position: 'absolute',
              right: 4,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'pointer',
              width: 20,
              height: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7
            }}
            aria-label={`Sort options for ${column}`}
            onClick={e => {
              e.stopPropagation();
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setHeaderMenu({ column, x: rect.right, y: rect.bottom });
            }}
            tabIndex={0}
          >
            <span style={{ fontSize: 14, pointerEvents: 'none' }}>⋮</span>
          </button>
        </th>
      ))}
    </>
  );
};

export default TableHeader;
