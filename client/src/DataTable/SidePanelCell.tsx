import React from "react";
import { formatValue } from '../utils/formatValue';
import { Column } from "../api";

interface SidePanelCellProps {
  value: any;
  column: string;
  columnInfo: Column | undefined;
  onForeignKeyClick: (column: string, value: any) => void;
  onReverseForeignKeyPillClick: (e: React.MouseEvent, column: string, value: any) => void;
}

const SidePanelCell: React.FC<SidePanelCellProps> = ({
  value,
  column,
  columnInfo,
  onForeignKeyClick,
  onReverseForeignKeyPillClick,
}) => {
  const isForeignKey = columnInfo?.foreign_key !== undefined;
  const hasReverseForeignKeys = columnInfo?.reverse_foreign_keys && columnInfo.reverse_foreign_keys.length > 0;
  
  // For multiline content, we want to preserve formatting
  const displayValue = value === null || value === undefined ? 'NULL' : String(value);
  
  if (isForeignKey) {
    return (
      <span 
        className="foreign-key-pill" 
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onForeignKeyClick(column, value);
        }}
      >
        {displayValue}
      </span>
    );
  } else if (hasReverseForeignKeys) {
    return (
      <span 
        className="reverse-foreign-key-pill" 
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onReverseForeignKeyPillClick(e, column, value);
        }}
      >
        {displayValue}
      </span>
    );
  } else {
    // For regular values, preserve multiline formatting
    return <span style={{ whiteSpace: 'pre-wrap' }}>{displayValue}</span>;
  }
};

export default SidePanelCell;
