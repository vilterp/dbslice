import React from 'react';
import { HistogramData } from './api';

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

interface NumericHistogramProps {
  columnName: string;
  data: HistogramData[];
  currentRange?: RangeSelection;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
}

const NumericHistogram: React.FC<NumericHistogramProps> = ({
  columnName,
  data,
  currentRange,
  handleRangeSelection,
}) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="histogram-loading">Loading histogram...</div>;
  }

  // Find min/max for the axis
  const min = Math.min(...data.map(d => d.bin_start ?? 0));
  const max = Math.max(...data.map(d => d.bin_end ?? 0));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="numeric-histogram" style={{ display: 'flex', alignItems: 'flex-end', width: '100%', height: 48, position: 'relative', background: '#f8f9fa', borderRadius: 6, overflow: 'hidden', margin: '0.5rem 0' }}>
      {data.map((item, idx) => {
        const left = ((item.bin_start! - min) / (max - min)) * 100;
        const right = ((item.bin_end! - min) / (max - min)) * 100;
        const width = right - left;
        const isInRange = currentRange?.isSelecting &&
          item.bin_start !== undefined &&
          item.bin_start >= Math.min(currentRange.start, currentRange.end) &&
          item.bin_end !== undefined &&
          item.bin_end <= Math.max(currentRange.start, currentRange.end);
        return (
          <div
            key={idx}
            className={`numeric-histogram-region${isInRange ? ' in-range' : ''}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              height: `${(item.count / maxCount) * 100}%`,
              background: isInRange ? '#a3d2f0' : '#bcdffb',
              borderRight: idx < data.length - 1 ? '1px solid #e0e0e0' : undefined,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            title={`${item.bin_start?.toFixed(1)} - ${item.bin_end?.toFixed(1)}: ${item.count}`}
            onClick={() => handleRangeSelection(columnName, item)}
          >
            {/* Optionally, show count or bin range on hover */}
          </div>
        );
      })}
      {/* Axis labels */}
      <div style={{ position: 'absolute', left: 0, bottom: -18, fontSize: 12, color: '#888' }}>{min.toFixed(1)}</div>
      <div style={{ position: 'absolute', right: 0, bottom: -18, fontSize: 12, color: '#888' }}>{max.toFixed(1)}</div>
    </div>
  );
};

export default NumericHistogram;
