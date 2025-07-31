import "./Histogram.css";
import React from 'react';
import { HistogramData, Filter } from '../api';
import NumericHistogram from './NumericHistogram';
import DiscreteHistogram from './DiscreteHistogram';

type HistogramProps = {
  columnName: string;
  data: HistogramData[];
  isNumerical: boolean;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
  filters?: Filter[];
};

const Histogram: React.FC<HistogramProps> = ({
  columnName,
  data,
  isNumerical,
  addFilter,
  removeFilter,
  filters = [],
}) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="histogram-loading">Loading histogram...</div>;
  }

  if (isNumerical) {
    return <NumericHistogram columnName={columnName} data={data} addFilter={addFilter} removeFilter={removeFilter} filters={filters} />;
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
