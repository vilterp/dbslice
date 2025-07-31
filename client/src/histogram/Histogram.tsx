import "./Histogram.css";
import React from 'react';
import { HistogramData, Filter } from '../api';
import NumericHistogram from './NumericHistogram';
import DiscreteHistogram from './DiscreteHistogram';

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

type HistogramProps = {
  columnName: string;
  data: HistogramData[];
  isNumerical: boolean;
  currentRange?: RangeSelection;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
  filters?: Filter[];
};

const Histogram: React.FC<HistogramProps> = ({
  columnName,
  data,
  isNumerical,
  currentRange,
  handleRangeSelection,
  addFilter,
  removeFilter,
  filters = [],
}) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="histogram-loading">Loading histogram...</div>;
  }

  if (isNumerical) {
    return <NumericHistogram columnName={columnName} data={data} currentRange={currentRange} handleRangeSelection={handleRangeSelection} addFilter={addFilter} removeFilter={removeFilter} filters={filters} />;
  }

  return (
    <DiscreteHistogram
      columnName={columnName}
      data={data}
      addFilter={addFilter}
      removeFilter={removeFilter}
      filters={filters}
    />
  );
};

export default Histogram;
