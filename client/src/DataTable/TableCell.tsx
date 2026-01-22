import React from "react";
import { formatValue } from '../utils/formatValue';
import { Column } from "../api";

interface TableCellProps {
  value: any;
  column: string;
  columnInfo: Column | undefined;
  cellIndex: number;
  rowData: any;
  onContextMenu: (e: React.MouseEvent, column: string, value: any, rowData: any) => void;
  onForeignKeyClick: (column: string, value: any, rowData: any) => void;
  onReverseForeignKeyPillClick: (e: React.MouseEvent, column: string, value: any, rowData: any) => void;
}

const TableCell: React.FC<TableCellProps> = ({
  value,
  column,
  columnInfo,
  cellIndex,
  rowData,
  onContextMenu,
  onForeignKeyClick,
  onReverseForeignKeyPillClick,
}) => {
  const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '');
  const isForeignKey = columnInfo?.foreign_key !== undefined;
  const hasReverseForeignKeys = columnInfo?.reverse_foreign_keys && columnInfo.reverse_foreign_keys.length > 0;

  // Determine the click handler based on the type of relationship
  let clickHandler: ((e: React.MouseEvent) => void) | undefined;
  if (isForeignKey) {
    clickHandler = (e) => {
      e.stopPropagation();
      onForeignKeyClick(column, value, rowData);
    };
  } else if (hasReverseForeignKeys) {
    // For reverse foreign keys, always show a menu (even if there's only one)
    clickHandler = (e) => {
      e.stopPropagation();
      onReverseForeignKeyPillClick(e, column, value, rowData);
    };
  }

  return (
    <td
      key={cellIndex}
      style={isNumber ? { textAlign: 'right' } : {}}
      className={`table-cell ${isForeignKey ? 'foreign-key-cell' : hasReverseForeignKeys ? 'reverse-foreign-key-cell' : ''}`}
      onContextMenu={e => onContextMenu(e, column, value, rowData)}
      onClick={clickHandler}
    >
      {isForeignKey ? (
        <span className="foreign-key-pill">
          {formatValue(value)}
        </span>
      ) : hasReverseForeignKeys ? (
        <span className="reverse-foreign-key-pill">
          {formatValue(value)}
        </span>
      ) : (
        formatValue(value)
      )}
    </td>
  );
};

export default TableCell;
