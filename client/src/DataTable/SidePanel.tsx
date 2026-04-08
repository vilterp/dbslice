import React, { useState, useRef, useEffect } from "react";
import "./SidePanel.css";
import "./DataTable.css"; // Import for pill styles
import CopyButton from "./CopyButton";
import SidePanelCell from "./SidePanelCell";
import DropdownMenu from "../components/DropdownMenu";
import { Column } from "../api";
import { FKNavSpec } from "../../../src/types";

interface SidePanelProps {
  selectedRow: any | null;
  onClose: () => void;
  columns: Column[];
  onForeignKeyClick: (column: string, value: any, rowData: any) => void;
  onNavigateToReferencingTable?: (nav: FKNavSpec) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ 
  selectedRow, 
  onClose, 
  columns, 
  onForeignKeyClick, 
  onNavigateToReferencingTable
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [reverseForeignKeyMenu, setReverseForeignKeyMenu] = useState<{
    column: string;
    value: any;
    x: number;
    y: number;
  } | null>(null);

  // Create a map of column names to column info for quick lookup
  const columnMap = new Map<string, Column>();
  columns.forEach(col => columnMap.set(col.column_name, col));

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 150);
  };

  // Handler for foreign key clicks - close panel and navigate
  const handleForeignKeyClick = (column: string, value: any, rowData: any) => {
    handleClose();
    onForeignKeyClick(column, value, rowData);
  };

  // Handler for reverse foreign key pill clicks - show local dropdown
  const handleReverseForeignKeyPillClick = (e: React.MouseEvent, column: string, value: any) => {
    setReverseForeignKeyMenu({
      column,
      value,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Close dropdown menu on outside click
  const reverseForeignKeyMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (reverseForeignKeyMenuRef.current && !reverseForeignKeyMenuRef.current.contains(e.target as Node)) {
        setReverseForeignKeyMenu(null);
      }
    }
    if (reverseForeignKeyMenu) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [reverseForeignKeyMenu]);

  if (!selectedRow) return null;

  return (
    <div className="detail-panel-overlay" onClick={handleClose}>
      <div className={`detail-panel ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="detail-panel-header">
          <h3>Row Details</h3>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        <div className="detail-panel-content">
          {Object.entries(selectedRow).map(([key, value]) => (
            <div key={key} className="detail-row">
              <div className="detail-label">
                {key}
                <CopyButton value={String(value)} />
              </div>
              <div className="detail-value">
                <SidePanelCell
                  value={value}
                  column={key}
                  columnInfo={columnMap.get(key)}
                  rowData={selectedRow}
                  onForeignKeyClick={handleForeignKeyClick}
                  onReverseForeignKeyPillClick={handleReverseForeignKeyPillClick}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Reverse foreign key navigation menu */}
        {reverseForeignKeyMenu && (
          <div
            ref={reverseForeignKeyMenuRef}
            style={{
              position: 'fixed',
              top: reverseForeignKeyMenu.y,
              left: reverseForeignKeyMenu.x,
              right: 'auto',
              zIndex: 1001, // Higher than side panel
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
                          rowData: selectedRow,
                        });
                      }
                      setReverseForeignKeyMenu(null);
                      handleClose();
                    }}
                  >
                    Go to {reverseFk.source_table}
                  </div>
                ));
              })()}
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidePanel;