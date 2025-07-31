import "./Histogram.css";
import React from 'react';
import { HistogramData, Filter, HistogramResult } from '../api';
import NumericHistogram from './NumericHistogram';
import DiscreteHistogram from './DiscreteHistogram';

type HistogramProps = {
  columnName: string;
  data: HistogramData[] | HistogramResult;
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
  // Handle HistogramResult type (new API format)
  if (data && typeof data === 'object' && 'data' in data) {
    const result = data as HistogramResult;
    const histogramData = result.data;
    const error = result.error;
    const isEmpty = result.isEmpty;
    
    if (isNumerical) {
      return (
        <NumericHistogram 
          columnName={columnName} 
          data={histogramData} 
          error={error}
          isEmpty={isEmpty}
          addFilter={addFilter} 
          removeFilter={removeFilter} 
          filters={filters} 
        />
      );
    }

    return (
      <DiscreteHistogram
        columnName={columnName}
        data={histogramData}
        error={error}
        isEmpty={isEmpty}
        addFilter={addFilter}
        removeFilter={removeFilter}
        filters={filters}
      />
    );
  }
  
  // Handle legacy HistogramData[] type for backward compatibility
  const histogramData = Array.isArray(data) ? data : [];
  if (histogramData.length === 0) {
    return <div className="histogram-loading">Loading histogram...</div>;
  }

  if (isNumerical) {
    return <NumericHistogram columnName={columnName} data={histogramData} addFilter={addFilter} removeFilter={removeFilter} filters={filters} />;
  }

  return (
    <DiscreteHistogram
      columnName={columnName}
      data={histogramData}
      addFilter={addFilter}
      removeFilter={removeFilter}
      filters={filters}
    />
  );
};

export default Histogram;
