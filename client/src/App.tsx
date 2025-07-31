import React, { useState, useEffect } from 'react';
import './App.css';
import TableHeader from './TableHeader';
import FilterBar from './FilterBar';
import Sidebar from './Sidebar';
import HeaderMenu from './HeaderMenu';
import {
  Table,
  Column,
  HistogramData,
  TableDataResponse,
  SortDirection,
  Filter,
  fetchTables,
  fetchColumns,
  fetchTableData,
  fetchHistograms,
} from './api';
import { updateURL, loadFromURL } from './urlState';
interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

function App() {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableTotal, setTableTotal] = useState<number>(0);
  const [histograms, setHistograms] = useState<{[key: string]: HistogramData[]}>({});
  const [loading, setLoading] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [rangeSelections, setRangeSelections] = useState<{[key: string]: RangeSelection}>({});
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('');
  const [headerMenu, setHeaderMenu] = useState<{column: string, x: number, y: number} | null>(null);


  useEffect(() => {
    fetchTables()
      .then((data) => setTables(data))
      .catch((e) => console.error('Error fetching tables:', e));
  }, []);

  // Load from URL after tables are fetched
  useEffect(() => {
    if (tables.length > 0) {
      loadFromURL(
        tables,
        setSelectedTable,
        setFilters,
        setSortColumn,
        setSortDirection
      );
    }
  }, [tables]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      if (tables.length > 0) {
        loadFromURL(
          tables,
          setSelectedTable,
          setFilters,
          setSortColumn,
          setSortDirection
        );
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [tables]);

  useEffect(() => {
    if (selectedTable) {
      fetchColumns(selectedTable)
        .then((data) => setColumns(data))
        .catch((e) => console.error('Error fetching columns:', e));
      fetchTableData(selectedTable, filters, sortColumn, sortDirection)
        .then((result) => {
          setTableData(result.data || []);
          setTableTotal(typeof result.total === 'number' ? result.total : 0);
        })
        .catch((e) => {
          console.error('Error fetching table data:', e);
          setTableData([]);
          setTableTotal(0);
        });
      updateURL(selectedTable, filters, sortColumn, sortDirection);
    }
    // eslint-disable-next-line
  }, [selectedTable, filters, sortColumn, sortDirection]);

  useEffect(() => {
    if (selectedTable && columns.length > 0) {
      fetchHistograms(selectedTable, columns, filters)
        .then((data) => setHistograms(data))
        .catch((e) => console.error('Error fetching histograms:', e));
    }
  }, [selectedTable, filters, columns]);

  // All data loading functions are now imported from api.ts

  const addFilter = (column: string, value: string, type: 'exact' | 'range' = 'exact', min?: number, max?: number) => {
    const existingFilter = filters.find(f => f.column === column);
    if (existingFilter) {
      setFilters(filters.map(f => f.column === column ? { column, value, type, min, max } : f));
    } else {
      setFilters([...filters, { column, value, type, min, max }]);
    }
  };

  const removeFilter = (column: string) => {
    setFilters(filters.filter(f => f.column !== column));
  };

  const toggleColumnCollapse = (columnName: string) => {
    const newCollapsed = new Set(collapsedColumns);
    if (newCollapsed.has(columnName)) {
      newCollapsed.delete(columnName);
    } else {
      newCollapsed.add(columnName);
    }
    setCollapsedColumns(newCollapsed);
  };

  const isNumericalColumn = (dataType: string) => {
    return ['INTEGER', 'BIGINT', 'DECIMAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'REAL'].some(type => 
      dataType.toUpperCase().includes(type)
    );
  };

  const handleRangeSelection = (columnName: string, item: HistogramData) => {
    if (!item.bin_start || !item.bin_end) return;
    
    const currentRange = rangeSelections[columnName];
    
    if (!currentRange || !currentRange.isSelecting) {
      // Start new selection
      setRangeSelections({
        ...rangeSelections,
        [columnName]: {
          start: item.bin_start,
          end: item.bin_end,
          isSelecting: true
        }
      });
    } else {
      // Complete selection
      const min = Math.min(currentRange.start, item.bin_start);
      const max = Math.max(currentRange.end, item.bin_end);
      
      addFilter(columnName, `${min}-${max}`, 'range', min, max);
      
      setRangeSelections({
        ...rangeSelections,
        [columnName]: { start: 0, end: 0, isSelecting: false }
      });
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>DuckDB Explorer</h1>
        <div className="table-selector">
          <select 
            value={selectedTable} 
            onChange={(e) => setSelectedTable(e.target.value)}
            className="table-select"
          >
            <option value="">Select a table...</option>
            {tables.map(table => (
              <option key={table.table_name} value={table.table_name}>
                {table.table_name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {selectedTable && (
        <div className="main-content">
          <FilterBar filters={filters} removeFilter={removeFilter} />

          <div className="content-wrapper">
            <Sidebar
              columns={columns}
              histograms={histograms}
              filters={filters}
              collapsedColumns={collapsedColumns}
              rangeSelections={rangeSelections}
              toggleColumnCollapse={toggleColumnCollapse}
              isNumericalColumn={isNumericalColumn}
              handleRangeSelection={handleRangeSelection}
              addFilter={addFilter}
            />

            <div className="main-panel">
              {loading ? (
                <div className="loading">Loading...</div>
              ) : (
                <div className="data-table">
                  <h3>Data ({tableTotal} rows)</h3>
                  {tableData.length > 0 && (
                    <div style={{ position: 'relative' }}>
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
                        setSortDirection={(dir: string) => setSortDirection(dir as SortDirection)}
                        setHeaderMenu={setHeaderMenu}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
