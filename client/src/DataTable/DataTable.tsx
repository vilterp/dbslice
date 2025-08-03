import "./DataTable.css";
import React, { useState, useRef, useEffect } from "react";
import { formatValue } from '../utils/formatValue';
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
import SidePanel from "./SidePanel";
import DropdownMenu from "../components/DropdownMenu";
import { SortDirection, Column } from "../api";

interface DataTableProps {
  tableData: any[];
  columns: Column[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  setSortColumn: (col: string) => void;
  setSortDirection: (dir: SortDirection) => void;
  addFilter: (column: string, value: any) => void;
  onNavigateToForeignKey?: (targetTable: string, targetColumn: string, value: any) => void;
}


const DataTable: React.FC<DataTableProps> = ({
  tableData,
  columns,
  sortColumn,
  sortDirection,
  headerMenu,
  setHeaderMenu,
  setSortColumn,
  setSortDirection,
  addFilter,
  onNavigateToForeignKey,
}) => {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [cellMenu, setCellMenu] = useState<{
    column: string;
    value: any;
    x: number;
    y: number;
  } | null>(null);

  // Get column names from first row
  const columnNames = tableData.length > 0 ? Object.keys(tableData[0]) : [];
  
  // Create a map of column names to column info for quick lookup
  const columnMap = new Map<string, Column>();
  columns.forEach(col => columnMap.set(col.column_name, col));

  // Handler for right-click on cell
  const handleCellContextMenu = (
    e: React.MouseEvent,
    column: string,
    value: any
  ) => {
    e.preventDefault();
    setCellMenu({
      column,
      value,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Handler for selecting filter action
  const handleAddFilter = () => {
    if (cellMenu) {
      addFilter(cellMenu.column, cellMenu.value);
      setCellMenu(null);
    }
  };

  // Handler for navigating to foreign key
  const handleNavigateToForeignKey = () => {
    if (cellMenu && onNavigateToForeignKey) {
      const columnInfo = columnMap.get(cellMenu.column);
      if (columnInfo?.foreign_key) {
        onNavigateToForeignKey(
          columnInfo.foreign_key.referenced_table,
          columnInfo.foreign_key.referenced_column,
          cellMenu.value
        );
      }
      setCellMenu(null);
    }
  };

  // Handler for clicking on foreign key cell
  const handleForeignKeyClick = (column: string, value: any) => {
    if (onNavigateToForeignKey) {
      const columnInfo = columnMap.get(column);
      if (columnInfo?.foreign_key) {
        onNavigateToForeignKey(
          columnInfo.foreign_key.referenced_table,
          columnInfo.foreign_key.referenced_column,
          value
        );
      }
    }
  };

  // Close cell menu on outside click
  const cellMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cellMenuRef.current && !cellMenuRef.current.contains(e.target as Node)) {
        setCellMenu(null);
      }
    }
    if (cellMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [cellMenu]);

  return (
    <div className="data-table">
      {tableData.length > 0 && (
        <div style={{ position: "relative" }}>
          <table>
            <thead>
              <tr>
                <TableHeader
                  columns={columnNames}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  headerMenu={headerMenu}
                  setHeaderMenu={setHeaderMenu}
                />
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} onClick={() => setSelectedRow(row)} className="table-row">
                  {columnNames.map((col, cellIndex) => {
                    const value = row[col];
                    const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '');
                    const columnInfo = columnMap.get(col);
                    const isForeignKey = columnInfo?.foreign_key !== undefined;
                    
                    return (
                      <td
                        key={cellIndex}
                        style={isNumber ? { textAlign: 'right' } : {}}
                        className={`table-cell ${isForeignKey ? 'foreign-key-cell' : ''}`}
                        onContextMenu={e => handleCellContextMenu(e, col, value)}
                        onClick={isForeignKey ? (e) => {
                          e.stopPropagation();
                          handleForeignKeyClick(col, value);
                        } : undefined}
                      >
                        {formatValue(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {/* Existing header menu */}
          <HeaderMenu
            headerMenu={headerMenu}
            sortColumn={sortColumn}
            setSortColumn={setSortColumn}
            sortDirection={sortDirection}
            setSortDirection={setSortDirection}
            setHeaderMenu={setHeaderMenu}
          />
          {/* Cell context menu for filtering */}
          {cellMenu && (
            <div
              ref={cellMenuRef}
              style={{
                position: 'fixed',
                top: cellMenu.y,
                left: cellMenu.x,
                right: 'auto',
                zIndex: 1000,
              }}
            >
              <DropdownMenu align="left">
                <div
                  style={{ padding: '8px 16px', cursor: 'pointer' }}
                  onClick={handleAddFilter}
                >
                  Filter to this value
                </div>
                {(() => {
                  const columnInfo = columnMap.get(cellMenu.column);
                  if (columnInfo?.foreign_key) {
                    return (
                      <div
                        style={{ padding: '8px 16px', cursor: 'pointer', borderTop: '1px solid #eee' }}
                        onClick={handleNavigateToForeignKey}
                      >
                        Go to {columnInfo.foreign_key.referenced_table}
                      </div>
                    );
                  }
                  return null;
                })()}
              </DropdownMenu>
            </div>
          )}
          <SidePanel
            selectedRow={selectedRow}
            onClose={() => setSelectedRow(null)}
          />
        </div>
      )}
    </div>
  );
};

export default DataTable;
