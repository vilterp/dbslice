import React, { useState, useRef } from 'react';
import { HistogramData } from '../api';
import Tooltip from '../components/Tooltip';

interface RangeSelection {
  start: number;
  end: number;
  isSelecting: boolean;
}

type NumericHistogramProps = {
  columnName: string;
  data: HistogramData[];
  currentRange?: RangeSelection;
  handleRangeSelection: (columnName: string, item: HistogramData) => void;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
};

const NumericHistogram: React.FC<NumericHistogramProps> = ({
  columnName,
  data,
  currentRange,
  handleRangeSelection,
  addFilter,
}) => {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data || data.length === 0) {
    return <div>No data available</div>;
  }

  // Sort data by bin_start to ensure proper order
  const sortedData = [...data].sort((a, b) => (a.bin_start || 0) - (b.bin_start || 0));
  
  const maxCount = Math.max(...sortedData.map(d => d.count));
  const minValue = Math.min(...sortedData.map(d => d.bin_start || 0));
  const maxValue = Math.max(...sortedData.map(d => d.bin_end || 0));

  const chartHeight = 120;
  const chartWidth = 250;
  const marginLeft = 10;
  const marginRight = 10;
  const marginTop = 5;
  const marginBottom = 15;

  return (
    <div className="numeric-histogram" style={{ padding: '10px' }}>
      <svg 
        width={chartWidth + marginLeft + marginRight} 
        height={chartHeight + marginTop + marginBottom}
        style={{ overflow: 'visible' }}
      >
        {/* Y-axis line */}
        <line
          x1={marginLeft}
          y1={marginTop}
          x2={marginLeft}
          y2={chartHeight + marginTop}
          stroke="#ccc"
          strokeWidth={1}
        />
        
        {/* X-axis line */}
        <line
          x1={marginLeft}
          y1={chartHeight + marginTop}
          x2={chartWidth + marginLeft}
          y2={chartHeight + marginTop}
          stroke="#ccc"
          strokeWidth={1}
        />

        {/* Histogram bars */}
        {sortedData.map((item, index) => {
          const binStart = item.bin_start || 0;
          const binEnd = item.bin_end || 0;
          const binWidth = binEnd - binStart;
          const valueRange = maxValue - minValue;
          
          const x = marginLeft + ((binStart - minValue) / valueRange) * chartWidth;
          const width = (binWidth / valueRange) * chartWidth;
          const height = (item.count / maxCount) * chartHeight;
          const y = marginTop + chartHeight - height;

          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={width}
              height={height}
              fill="#bbdefb"
              stroke="#fff"
              strokeWidth={0.5}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (item.bin_start !== undefined && item.bin_end !== undefined) {
                  addFilter(columnName, `${item.bin_start}-${item.bin_end}`, 'range', item.bin_start, item.bin_end);
                }
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  visible: true,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  content: `Count: ${item.count}`
                });
              }}
              onMouseLeave={() => {
                setTooltip({ visible: false, x: 0, y: 0, content: '' });
              }}
            />
          );
        })}


        {/* X-axis labels (min and max) */}
        <text
          x={marginLeft}
          y={chartHeight + marginTop + 15}
          textAnchor="start"
          fontSize="10"
          fill="#666"
        >
          {minValue.toLocaleString()}
        </text>
        <text
          x={chartWidth + marginLeft}
          y={chartHeight + marginTop + 15}
          textAnchor="end"
          fontSize="10"
          fill="#666"
        >
          {maxValue.toLocaleString()}
        </text>


      </svg>
      <Tooltip 
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />
    </div>
  );
};

export default NumericHistogram;
