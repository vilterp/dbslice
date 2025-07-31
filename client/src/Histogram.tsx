import React from 'react';
import { HistogramData } from './api';

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

interface HistogramProps {
  columnName: string;
  data: HistogramData[];
  isNumerical: boolean;
  currentRange?: RangeSelection;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
}

const Histogram: React.FC<HistogramProps> = ({
  columnName,
  data,
  isNumerical,
  currentRange,
  handleRangeSelection,
  addFilter,
}) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="histogram-loading">Loading histogram...</div>;
  }

  const maxCount = Math.max(...data.map(h => h.count));

  return (
    <>
      {isNumerical && currentRange?.isSelecting && (
        <div className="range-selection-hint">
          Click another bar to complete range selection
        </div>
      )}
      {data.map((item, index) => {
        const barWidth = (item.count / maxCount) * 100;
        const displayValue = item.bin_start !== undefined && item.bin_end !== undefined
          ? `${item.bin_start.toFixed(1)}-${item.bin_end.toFixed(1)}`
          : String(item[columnName]);
        const isInRange = currentRange?.isSelecting &&
          item.bin_start !== undefined &&
          item.bin_start >= Math.min(currentRange.start, currentRange.end) &&
          item.bin_end !== undefined &&
          item.bin_end <= Math.max(currentRange.start, currentRange.end);
        const isOthers = item.is_others === true;
        return (
          <div
            key={index}
            className={`histogram-bar ${isInRange ? 'in-range' : ''} ${isOthers ? 'others-bar' : ''}`}
            onClick={() => {
              if (isOthers) return;
              if (isNumerical && item.bin_start !== undefined) {
                handleRangeSelection(columnName, item);
              } else {
                addFilter(columnName, String(item[columnName]));
              }
            }}
            style={{ cursor: isOthers ? 'default' : 'pointer' }}
          >
            <div className="bar-label">{displayValue}</div>
            <div className="bar-container">
              <div
                className="bar-fill"
                style={{ width: `${barWidth}%` }}
              ></div>
              <span className="bar-count">{item.count}</span>
            </div>
          </div>
        );
      })}
    </>
  );
};

export default Histogram;
