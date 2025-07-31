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
