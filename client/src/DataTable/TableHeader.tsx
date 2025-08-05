import React from 'react';
import DropdownMenu from '../components/DropdownMenu';
import { SortDirection, Column } from '../api';

interface TableHeaderProps {
  columns: string[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  columnInfo?: Column[];
  onJoinableColumnClick?: (column: string, event: React.MouseEvent) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({ columns, sortColumn, sortDirection, headerMenu, setHeaderMenu, columnInfo = [], onJoinableColumnClick }) => {
  // Create a map of column names to column info for quick lookup
  const columnMap = new Map<string, Column>();
  columnInfo.forEach(col => columnMap.set(col.column_name, col));
  return (
    <>
      {columns.map(column => {
        const isActive = headerMenu?.column === column;
        const columnData = columnMap.get(column);
        const hasReverseForeignKeys = columnData?.reverse_foreign_keys && columnData.reverse_foreign_keys.length > 0;
        
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
            <span style={{ verticalAlign: 'middle' }}>
              {hasReverseForeignKeys ? (
                <span
                  style={{
                    padding: '2px 6px',
                    backgroundColor: '#8b5cf6',
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (onJoinableColumnClick) {
                      onJoinableColumnClick(column, e);
                    }
                  }}
                >
                  {column}
                </span>
              ) : (
                column
              )}
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
            {/* Dropdown is now handled by HeaderMenu, not here */}
          </th>
        );
      })}
    </>
  );
};

export default TableHeader;
