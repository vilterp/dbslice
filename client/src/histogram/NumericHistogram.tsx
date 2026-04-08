import React, { useState, useRef } from 'react';
import { HistogramData } from '../api';
import Tooltip from '../components/Tooltip';
import { useTooltip } from '../components/Tooltip';
import { Filter, RangeFilter } from '../../../src/types';

type NumericHistogramProps = {
  columnName: string;
  data: HistogramData[];
  error?: string;
  isEmpty?: boolean;
  addFilter: (column: string, value: string, type?: 'exact' | 'range', min?: number, max?: number) => void;
  removeFilter: (column: string, value: string) => void;
  filters?: Filter[];
};

const NumericHistogram: React.FC<NumericHistogramProps> = ({
  columnName,
  data,
  error,
  isEmpty,
  addFilter,
  removeFilter,
  filters = [],
}) => {
  const { tooltip, showTooltip, hideTooltip } = useTooltip();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{ startX: number; currentX: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const formatNumber = (num: number): string => {
    if (Math.abs(num) >= 1000000 || (Math.abs(num) < 0.01 && num !== 0)) {
      return num.toExponential(2);
    }
    if (Math.abs(num) >= 100) return num.toFixed(0);
    if (Math.abs(num) >= 1) return num.toFixed(2);
    return num.toFixed(3);
  };

  if (error) {
    return (
      <div className="histogram-error min100px">
        <div className="histogram-error-title">Error loading histogram</div>
        <div>{error}</div>
      </div>
    );
  }

  if (isEmpty || !data || data.length === 0) {
    return (
      <div className="histogram-empty min100px">No data available for this column</div>
    );
  }

  const sortedData = [...data].sort((a, b) => (a.bin_start || 0) - (b.bin_start || 0));

  const chartHeight = 80;
  const chartWidth = 250;
  const marginLeft = 8;
  const marginRight = 8;
  const marginTop = 2;
  const marginBottom = 8;

  const activeFilter = filters.find(
    (f): f is RangeFilter => f.type === 'range' && f.column === columnName
  );

  // When a filter is active, zoom into that range
  const displayData = activeFilter
    ? sortedData.filter(
        item =>
          item.bin_start !== undefined &&
          item.bin_end !== undefined &&
          item.bin_start < activeFilter.max &&
          item.bin_end > activeFilter.min
      )
    : sortedData;

  const displayMinValue = activeFilter
    ? activeFilter.min
    : displayData.reduce((min, d) => Math.min(min, d.bin_start || 0), Infinity);
  const displayMaxValue = activeFilter
    ? activeFilter.max
    : displayData.reduce((max, d) => Math.max(max, d.bin_end || 0), -Infinity);
  const displayMaxCount = Math.max(1, displayData.reduce((max, d) => Math.max(max, d.count), 0));
  const valueRange = displayMaxValue - displayMinValue;

  const xToValue = (x: number): number => {
    const clamped = Math.max(marginLeft, Math.min(marginLeft + chartWidth, x));
    return displayMinValue + ((clamped - marginLeft) / chartWidth) * valueRange;
  };

  const getSVGX = (e: React.MouseEvent): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    return e.clientX - rect.left;
  };

  const commitDrag = (state: { startX: number; currentX: number }) => {
    const x1 = Math.min(state.startX, state.currentX);
    const x2 = Math.max(state.startX, state.currentX);
    if (x2 - x1 < 4) {
      // Click: select the bin under the cursor, or clear if clicking empty space
      const clickValue = xToValue((state.startX + state.currentX) / 2);
      const clickedBin = displayData.find(
        item =>
          item.bin_start !== undefined &&
          item.bin_end !== undefined &&
          clickValue >= item.bin_start &&
          clickValue < item.bin_end
      );
      if (clickedBin) {
        addFilter(columnName, `${clickedBin.bin_start}-${clickedBin.bin_end}`, 'range', clickedBin.bin_start!, clickedBin.bin_end!);
      } else if (activeFilter) {
        removeFilter(columnName, '');
      }
    } else {
      const filterMin = xToValue(x1);
      const filterMax = xToValue(x2);
      addFilter(columnName, `${filterMin}-${filterMax}`, 'range', filterMin, filterMax);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragState({ startX: getSVGX(e), currentX: getSVGX(e) });
    hideTooltip();
    setHoveredIndex(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    setDragState({ ...dragState, currentX: getSVGX(e) });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragState) return;
    commitDrag(dragState);
    setDragState(null);
  };

  const handleMouseLeave = () => {
    if (dragState) {
      commitDrag(dragState);
      setDragState(null);
    }
    setHoveredIndex(null);
    hideTooltip();
  };

  const isDragging = dragState !== null;

  // Only show selection overlay while dragging (applied filter is shown via zoom + bar color)
  const selectionRect = dragState
    ? {
        x: Math.min(dragState.startX, dragState.currentX),
        width: Math.abs(dragState.currentX - dragState.startX),
      }
    : null;

  return (
    <div className="numeric-histogram min100px" style={{ position: 'relative' }}>
      {activeFilter && (
        <button
          onClick={() => removeFilter(columnName, '')}
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            padding: '0 4px',
            fontSize: 10,
            lineHeight: '14px',
            cursor: 'pointer',
            border: '1px solid #90caf9',
            borderRadius: 3,
            background: '#e3f2fd',
            color: '#1565c0',
            zIndex: 1,
          }}
        >
          ×
        </button>
      )}
      <svg
        ref={svgRef}
        width={chartWidth + marginLeft + marginRight}
        height={chartHeight + marginTop + marginBottom}
        className="numeric-histogram-svg"
        style={{ cursor: isDragging ? 'ew-resize' : 'crosshair', userSelect: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Y-axis */}
        <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={chartHeight + marginTop} stroke="#ccc" strokeWidth={1} />
        {/* X-axis */}
        <line x1={marginLeft} y1={chartHeight + marginTop} x2={chartWidth + marginLeft} y2={chartHeight + marginTop} stroke="#ccc" strokeWidth={1} />

        {/* Histogram bars */}
        {displayData.map((item, index) => {
          const binStart = item.bin_start || 0;
          const binEnd = item.bin_end || 0;
          const binW = binEnd - binStart;
          const x = marginLeft + ((binStart - displayMinValue) / valueRange) * chartWidth;
          const w = Math.max(0.5, (binW / valueRange) * chartWidth);
          const h = (item.count / displayMaxCount) * chartHeight;
          const y = marginTop + chartHeight - h;
          const isHovered = !isDragging && hoveredIndex === index;
          const barColor = activeFilter
            ? (isHovered ? '#64b5f6' : '#90caf9')
            : (isHovered ? '#90caf9' : '#bbdefb');

          return (
            <g key={index}>
              <rect
                x={x} y={y} width={w} height={h}
                fill={barColor}
                stroke="#fff" strokeWidth={0.5}
                pointerEvents="none"
              />
              <rect
                x={x} y={marginTop} width={w} height={chartHeight}
                fill="transparent"
                style={{ pointerEvents: isDragging ? 'none' : 'all' }}
                onMouseEnter={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setHoveredIndex(index);
                  showTooltip(
                    r.left + r.width / 2,
                    r.top,
                    `Range: ${formatNumber(binStart)} – ${formatNumber(binEnd)}\nCount: ${item.count}`
                  );
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null);
                  hideTooltip();
                }}
              />
            </g>
          );
        })}

        {/* Drag selection overlay */}
        {selectionRect && selectionRect.width > 1 && (
          <rect
            x={selectionRect.x}
            y={marginTop}
            width={selectionRect.width}
            height={chartHeight}
            fill="rgba(33, 150, 243, 0.15)"
            stroke="#2196f3"
            strokeWidth={1}
            pointerEvents="none"
          />
        )}

        {/* X-axis labels */}
        <text x={marginLeft} y={chartHeight + marginTop + 10} textAnchor="start" fontSize="10" fill="#666">
          {formatNumber(displayMinValue)}
        </text>
        <text x={chartWidth + marginLeft} y={chartHeight + marginTop + 10} textAnchor="end" fontSize="10" fill="#666">
          {formatNumber(displayMaxValue)}
        </text>
      </svg>

      <Tooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} content={tooltip.content} />
    </div>
  );
};

export default NumericHistogram;
