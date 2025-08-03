import React, { useState } from "react";
import "./SidePanel.css";
import "./DataTable.css"; // Import for pill styles
import CopyButton from "./CopyButton";
import SidePanelCell from "./SidePanelCell";
import { Column } from "../api";

interface SidePanelProps {
  selectedRow: any | null;
  onClose: () => void;
  columns: Column[];
  onForeignKeyClick: (column: string, value: any) => void;
  onReverseForeignKeyPillClick: (e: React.MouseEvent, column: string, value: any) => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ 
  selectedRow, 
  onClose, 
  columns, 
  onForeignKeyClick, 
  onReverseForeignKeyPillClick 
}) => {
  const [isClosing, setIsClosing] = useState(false);

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
  const handleForeignKeyClick = (column: string, value: any) => {
    handleClose();
    onForeignKeyClick(column, value);
  };

  // Handler for reverse foreign key pill clicks - show menu first, then close panel
  const handleReverseForeignKeyPillClick = (e: React.MouseEvent, column: string, value: any) => {
    // Show the menu first
    onReverseForeignKeyPillClick(e, column, value);
    // Close the panel after a short delay to allow the menu to be positioned
    setTimeout(() => {
      handleClose();
    }, 50);
  };

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
                  onForeignKeyClick={handleForeignKeyClick}
                  onReverseForeignKeyPillClick={handleReverseForeignKeyPillClick}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;