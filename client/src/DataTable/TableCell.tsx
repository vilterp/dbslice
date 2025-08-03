import React from "react";
import { formatValue } from '../utils/formatValue';
import { Column } from "../api";

interface TableCellProps {
  value: any;
  column: string;
  columnInfo: Column | undefined;
  cellIndex: number;
  onContextMenu: (e: React.MouseEvent, column: string, value: any) => void;
  onForeignKeyClick: (column: string, value: any) => void;
  onReverseForeignKeyClick: (column: string, value: any, targetTable: string, targetColumn: string) => void;
}

const TableCell: React.FC<TableCellProps> = ({
  value,
  column,
  columnInfo,
  cellIndex,
  onContextMenu,
  onForeignKeyClick,
  onReverseForeignKeyClick,
}) => {
  const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '');
  const isForeignKey = columnInfo?.foreign_key !== undefined;
  const hasReverseForeignKeys = columnInfo?.reverse_foreign_keys && columnInfo.reverse_foreign_keys.length > 0;
  
  // Determine the click handler based on the type of relationship
  let clickHandler: ((e: React.MouseEvent) => void) | undefined;
  if (isForeignKey) {
    clickHandler = (e) => {
      e.stopPropagation();
      onForeignKeyClick(column, value);
    };
  } else if (hasReverseForeignKeys && columnInfo.reverse_foreign_keys!.length === 1) {
    // If there's only one reverse FK, click goes directly there
    const reverseFk = columnInfo.reverse_foreign_keys![0];
    clickHandler = (e) => {
      e.stopPropagation();
      onReverseForeignKeyClick(column, value, reverseFk.source_table, reverseFk.source_column);
    };
  }
  
  return (
    <td
      key={cellIndex}
      style={isNumber ? { textAlign: 'right' } : {}}
      className={`table-cell ${isForeignKey ? 'foreign-key-cell' : hasReverseForeignKeys ? 'reverse-foreign-key-cell' : ''}`}
      onContextMenu={e => onContextMenu(e, column, value)}
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
