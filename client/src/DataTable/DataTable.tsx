import "./DataTable.css";
import React, { useState, useRef, useEffect } from "react";
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
import SidePanel from "./SidePanel";
import TableCell from "./TableCell";
import DropdownMenu from "../components/DropdownMenu";
import { SortDirection, Column } from "../api";
import { Filter, FKNavSpec } from "../../../src/types";

interface DataTableProps {
  tableData: any[];
  columns: Column[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  setSortColumn: (col: string) => void;
  setSortDirection: (dir: SortDirection) => void;
  addFilter: (filter: Filter) => void;
  onNavigateToForeignKey?: (nav: FKNavSpec) => void;
  onNavigateToReferencingTable?: (nav: FKNavSpec) => void;
  onJoinWithTable?: (joinColumn: string, targetTable: string, targetColumn: string) => void;
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
  onNavigateToReferencingTable,
  onJoinWithTable,
}) => {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [cellMenu, setCellMenu] = useState<{
    column: string;
    value: any;
    x: number;
    y: number;
    rowData?: any;
  } | null>(null);
  const [reverseForeignKeyMenu, setReverseForeignKeyMenu] = useState<{
    column: string;
    value: any;
    x: number;
    y: number;
    rowData?: any;
  } | null>(null);
  const [joinMenu, setJoinMenu] = useState<{
    column: string;
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
    value: any,
    rowData: any
  ) => {
    e.preventDefault();
    setCellMenu({
      column,
      value,
      x: e.clientX,
      y: e.clientY,
      rowData,
    });
  };

  // Handler for selecting filter action
  const handleAddFilter = (negated = false) => {
    if (cellMenu) {
      addFilter({ type: 'exact', column: cellMenu.column, value: cellMenu.value, negated });
      setCellMenu(null);
    }
  };

  // Handler for navigating to foreign key
  const handleNavigateToForeignKey = () => {
    if (cellMenu && onNavigateToForeignKey) {
      const columnInfo = columnMap.get(cellMenu.column);
      if (columnInfo?.foreign_key) {
        onNavigateToForeignKey({
          table: columnInfo.foreign_key.referenced_table,
          column: columnInfo.foreign_key.referenced_column,
          value: cellMenu.value,
          allColumns: columnInfo.foreign_key.all_columns,
          allReferencedColumns: columnInfo.foreign_key.all_referenced_columns,
          rowData: cellMenu.rowData,
        });
      }
      setCellMenu(null);
      setSelectedRow(null);
    }
  };

  // Handler for clicking on foreign key cell
  const handleForeignKeyClick = (column: string, value: any, rowData: any) => {
    if (onNavigateToForeignKey) {
      const columnInfo = columnMap.get(column);
      if (columnInfo?.foreign_key) {
        onNavigateToForeignKey({
          table: columnInfo.foreign_key.referenced_table,
          column: columnInfo.foreign_key.referenced_column,
          value,
          allColumns: columnInfo.foreign_key.all_columns,
          allReferencedColumns: columnInfo.foreign_key.all_referenced_columns,
          rowData,
        });
      }
    }
  };

  // Handler for clicking on reverse foreign key pill - shows menu
  const handleReverseForeignKeyPillClick = (e: React.MouseEvent, column: string, value: any, rowData: any) => {
    setReverseForeignKeyMenu({
      column,
      value,
      x: e.clientX,
      y: e.clientY,
      rowData,
    });
  };

  // Handler for clicking on joinable column header pill - shows join menu
  const handleJoinableColumnClick = (column: string, event: React.MouseEvent) => {
    setJoinMenu({
      column,
      x: event.clientX,
      y: event.clientY,
    });
  };

  // Close cell menu on outside click
  const cellMenuRef = useRef<HTMLDivElement>(null);
  const reverseForeignKeyMenuRef = useRef<HTMLDivElement>(null);
  const joinMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (cellMenuRef.current && !cellMenuRef.current.contains(e.target as Node)) {
        setCellMenu(null);
      }
      if (reverseForeignKeyMenuRef.current && !reverseForeignKeyMenuRef.current.contains(e.target as Node)) {
        setReverseForeignKeyMenu(null);
      }
      if (joinMenuRef.current && !joinMenuRef.current.contains(e.target as Node)) {
        setJoinMenu(null);
      }
    }
    if (cellMenu || reverseForeignKeyMenu || joinMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [cellMenu, reverseForeignKeyMenu, joinMenu]);

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
                  columnInfo={columns}
                  onJoinableColumnClick={handleJoinableColumnClick}
                />
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} onClick={() => setSelectedRow(row)} className="table-row">
                  {columnNames.map((col, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      value={row[col]}
                      column={col}
                      columnInfo={columnMap.get(col)}
                      cellIndex={cellIndex}
                      rowData={row}
                      onContextMenu={handleCellContextMenu}
                      onForeignKeyClick={handleForeignKeyClick}
                      onReverseForeignKeyPillClick={handleReverseForeignKeyPillClick}
                    />
                  ))}
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
                  onClick={() => handleAddFilter()}
                >
                  Filter to this value
                </div>
                <div
                  style={{ padding: '8px 16px', cursor: 'pointer' }}
                  onClick={() => handleAddFilter(true)}
                >
                  Exclude this value
                </div>
                {(() => {
                  const columnInfo = columnMap.get(cellMenu.column);
                  const menuItems = [];
                  
                  // Add outward foreign key navigation
                  if (columnInfo?.foreign_key) {
                    menuItems.push(
                      <div
                        key="outward-fk"
                        style={{ padding: '8px 16px', cursor: 'pointer', borderTop: '1px solid #eee' }}
                        onClick={handleNavigateToForeignKey}
                      >
                        Go to {columnInfo.foreign_key.referenced_table}
                      </div>
                    );
                  }
                  
                  // Add inward foreign key navigation options
                  if (columnInfo?.reverse_foreign_keys && columnInfo.reverse_foreign_keys.length > 0) {
                    columnInfo.reverse_foreign_keys.forEach((reverseFk, index) => {
                      menuItems.push(
                        <div
                          key={`inward-fk-${index}`}
                          style={{ padding: '8px 16px', cursor: 'pointer', borderTop: '1px solid #eee' }}
                          onClick={() => {
                            if (onNavigateToReferencingTable) {
                              onNavigateToReferencingTable({
                                table: reverseFk.source_table,
                                column: reverseFk.source_column,
                                value: cellMenu.value,
                                allColumns: reverseFk.all_source_columns,
                                allReferencedColumns: reverseFk.all_referenced_columns,
                                rowData: cellMenu.rowData,
                              });
                            }
                            setCellMenu(null);
                            setSelectedRow(null);
                          }}
                        >
                          Show {reverseFk.source_table} → {cellMenu.column}
                        </div>
                      );
                    });
                  }
                  
                  return menuItems;
                })()}
              </DropdownMenu>
            </div>
          )}
          {/* Reverse foreign key navigation menu */}
          {reverseForeignKeyMenu && (
            <div
              ref={reverseForeignKeyMenuRef}
              style={{
                position: 'fixed',
                top: reverseForeignKeyMenu.y,
                left: reverseForeignKeyMenu.x,
                right: 'auto',
                zIndex: 1000,
              }}
            >
              <DropdownMenu align="left">
                {(() => {
                  const columnInfo = columnMap.get(reverseForeignKeyMenu.column);
                  if (!columnInfo?.reverse_foreign_keys) return null;
                  
                  return columnInfo.reverse_foreign_keys.map((reverseFk, index) => (
                    <div
                      key={`reverse-fk-${index}`}
                      style={{ padding: '8px 16px', cursor: 'pointer' }}
                      onClick={() => {
                        if (onNavigateToReferencingTable) {
                          onNavigateToReferencingTable({
                            table: reverseFk.source_table,
                            column: reverseFk.source_column,
                            value: reverseForeignKeyMenu.value,
                            allColumns: reverseFk.all_source_columns,
                            allReferencedColumns: reverseFk.all_referenced_columns,
                            rowData: reverseForeignKeyMenu.rowData,
                          });
                        }
                        setReverseForeignKeyMenu(null);
                        setSelectedRow(null);
                      }}
                    >
                      Go to {reverseFk.source_table}
                    </div>
                  ));
                })()}
              </DropdownMenu>
            </div>
          )}
          {/* Join menu for selecting target table */}
          {joinMenu && (
            <div
              ref={joinMenuRef}
              style={{
                position: 'fixed',
                top: joinMenu.y,
                left: joinMenu.x,
                right: 'auto',
                zIndex: 1000,
              }}
            >
              <DropdownMenu align="left">
                {(() => {
                  const columnInfo = columnMap.get(joinMenu.column);
                  if (!columnInfo?.reverse_foreign_keys) return null;
                  
                  return columnInfo.reverse_foreign_keys.map((reverseFk, index) => (
                    <div
                      key={`join-${index}`}
                      style={{ padding: '8px 16px', cursor: 'pointer' }}
                      onClick={() => {
                        if (onJoinWithTable) {
                          onJoinWithTable(joinMenu.column, reverseFk.source_table, reverseFk.source_column);
                        }
                        setJoinMenu(null);
                      }}
                    >
                      Join with {reverseFk.source_table}
                    </div>
                  ));
                })()}
              </DropdownMenu>
            </div>
          )}
          <SidePanel
            selectedRow={selectedRow}
            onClose={() => setSelectedRow(null)}
            columns={columns}
            onForeignKeyClick={handleForeignKeyClick}
            onNavigateToReferencingTable={onNavigateToReferencingTable}
          />
        </div>
      )}
    </div>
  );
};

export default DataTable;
