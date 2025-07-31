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
      {columns.map(column => {
        const isActive = headerMenu?.column === column;
        return (
          <th
            key={column}
            style={{
              position: 'relative',
              userSelect: 'none',
              background: isActive ? '#f0f0f0' : undefined,
              transition: 'background 0.15s',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#f0f0f0';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = isActive ? '#f0f0f0' : '';
            }}
            onClick={e => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setHeaderMenu({ column, x: rect.left, y: rect.bottom });
            }}
            tabIndex={0}
          >
            <span style={{ verticalAlign: 'middle' }}>{column}
              {sortColumn === column && sortDirection === 'asc' && <span style={{ marginLeft: 4 }}>▲</span>}
              {sortColumn === column && sortDirection === 'desc' && <span style={{ marginLeft: 4 }}>▼</span>}
            </span>
            <span
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.7,
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              ⋮
            </span>
          </th>
        );
      })}
    </>
  );
};

export default TableHeader;
