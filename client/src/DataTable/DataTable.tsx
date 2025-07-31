import React from "react";
import TableHeader from "./TableHeader";
import HeaderMenu from "./HeaderMenu";
import { abbreviateNumber } from "../utils";
import { SortDirection } from "../api";

interface DataTableProps {
  tableData: any[];
  tableTotal: number;
  sortColumn: string;
  sortDirection: SortDirection;
  headerMenu: { column: string; x: number; y: number } | null;
  setHeaderMenu: (menu: { column: string; x: number; y: number } | null) => void;
  setSortColumn: (col: string) => void;
  setSortDirection: (dir: SortDirection) => void;
}

const DataTable: React.FC<DataTableProps> = ({
  tableData,
  tableTotal,
  sortColumn,
  sortDirection,
  headerMenu,
  setHeaderMenu,
  setSortColumn,
  setSortDirection,
}) => (
  <div className="data-table">
    <h3>Data ({abbreviateNumber(tableTotal)} rows)</h3>
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
              <tr key={index}>
                {Object.values(row).map((value, cellIndex) => (
                  <td key={cellIndex}>{String(value)}</td>
                ))}
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
      </div>
    )}
  </div>
);

export default DataTable;
