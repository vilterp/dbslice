import "./DataTable.css";
import React, { useState } from "react";
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
import { SortDirection } from "../api";

interface DataTableProps {
  tableData: any[];
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  setSortColumn: (col: string) => void;
  setSortDirection: (dir: SortDirection) => void;
}

const DataTable: React.FC<DataTableProps> = ({
  tableData,
  sortColumn,
  sortDirection,
  headerMenu,
  setHeaderMenu,
  setSortColumn,
  setSortDirection,
}) => {
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const handleClosePanel = () => {
    setIsClosing(true);
    setTimeout(() => {
      setSelectedRow(null);
      setIsClosing(false);
    }, 150);
  };

  return (
  <div className="data-table">
    {tableData.length > 0 && (
      <div style={{ position: "relative" }}>
        <table>
          <thead>
            <tr>
              <TableHeader
                columns={Object.keys(tableData[0])}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                headerMenu={headerMenu}
                setHeaderMenu={setHeaderMenu}
              />
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index} onClick={() => setSelectedRow(row)} className="table-row">
                {Object.values(row).map((value, cellIndex) => {
                  const isNumber = typeof value === 'number' || (!isNaN(Number(value)) && value !== null && value !== '');
                  return (
                    <td
                      key={cellIndex}
                      style={isNumber ? { textAlign: 'right' } : {}}
                      className="table-cell"
                    >
                      {String(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <HeaderMenu
          headerMenu={headerMenu}
          sortColumn={sortColumn}
          setSortColumn={setSortColumn}
          sortDirection={sortDirection}
          setSortDirection={setSortDirection}
          setHeaderMenu={setHeaderMenu}
        />
        {selectedRow && (
          <div className="detail-panel-overlay" onClick={handleClosePanel}>
            <div className={`detail-panel ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
              <div className="detail-panel-header">
                <h3>Row Details</h3>
                <button className="close-button" onClick={handleClosePanel}>×</button>
              </div>
              <div className="detail-panel-content">
                {Object.entries(selectedRow).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <div className="detail-label">
                      {key}
                      <button 
                        className="copy-button"
                        onClick={() => navigator.clipboard.writeText(String(value))}
                        title="Copy value"
                      >
                        📋
                      </button>
                    </div>
                    <div className="detail-value">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
  );
};

export default DataTable;
