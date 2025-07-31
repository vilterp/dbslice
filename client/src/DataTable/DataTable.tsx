import "./DataTable.css";
import React, { useState } from "react";
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
import SidePanel from "./SidePanel";
import { SortDirection } from "../api";

interface DataTableProps {
  tableData: any[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  setSortColumn: (col: string) => void;
  setSortDirection: (dir: SortDirection) => void;
  addFilter: (column: string, value: any) => void;
  error?: string;
}


const DataTable: React.FC<DataTableProps> = ({
  tableData,
  sortColumn,
  sortDirection,
  headerMenu,
  setHeaderMenu,
  setSortColumn,
  setSortDirection,
  addFilter,
  error,
}) => {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [cellMenu, setCellMenu] = useState<{
    column: string;
    value: any;
    x: number;
    y: number;
  } | null>(null);

  // Get columns from first row
  const columns = tableData.length > 0 ? Object.keys(tableData[0]) : [];

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

  // Handler to close cell menu
  const handleCloseCellMenu = () => setCellMenu(null);

  if (error) {
    return (
      <div className="data-table">
        <div className="table-error" style={{
          padding: '40px',
          textAlign: 'center',
          color: '#d32f2f',
          backgroundColor: '#ffeaea',
          border: '1px solid #ffcccc',
          borderRadius: '8px',
          margin: '20px',
          fontSize: '16px'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '18px' }}>Error Loading Table Data</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table">
      {tableData.length > 0 && (
        <div style={{ position: "relative" }}>
          <table>
            <thead>
              <tr>
                <TableHeader
                  columns={columns}
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
                  {columns.map((col, cellIndex) => {
                    const value = row[col];
                    const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '');
                    return (
                      <td
                        key={cellIndex}
                        style={isNumber ? { textAlign: 'right' } : {}}
                        className="table-cell"
                        onContextMenu={e => handleCellContextMenu(e, col, value)}
                      >
                        {String(value)}
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
              style={{
                position: 'fixed',
                top: cellMenu.y,
                left: cellMenu.x,
                background: 'white',
                border: '1px solid #ccc',
                zIndex: 1000,
                minWidth: 160,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              onMouseLeave={handleCloseCellMenu}
            >
              <div
                style={{ padding: '8px 16px', cursor: 'pointer' }}
                onClick={handleAddFilter}
              >
                Filter to this value
              </div>
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
