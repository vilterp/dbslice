import React from 'react';
import { abbreviateNumber } from '../utils';

type OtherValuesProps = {
  barWidth: number;
  displayValue: string;
  count: number;
  addFilter: (column: string, value: string) => void;
  columnName: string;
};

const OtherValues: React.FC<OtherValuesProps> = ({
  barWidth,
  displayValue,
  count,
  addFilter,
  columnName,
}) => {
  const [showOtherInput, setShowOtherInput] = React.useState(false);
  const [otherInputValue, setOtherInputValue] = React.useState("");
  const otherInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div
      className="histogram-bar discrete-bar others-bar"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        minHeight: 24, 
        cursor: 'pointer', 
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
      }}
      onClick={() => {
        setShowOtherInput(true);
        setTimeout(() => otherInputRef.current?.focus(), 0);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          setShowOtherInput(true);
          setTimeout(() => otherInputRef.current?.focus(), 0);
        }
      }}
    >
      {!showOtherInput ? (
        <>
          <div style={{ 
            position: 'relative', 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center',
            minWidth: 0 // Allow flex item to shrink
          }}>
            <div
              className="bar-fill"
              style={{
                width: `${barWidth}%`,
                minWidth: 16,
                height: 24,
                position: 'absolute',
                left: 0,
                top: 0,
                fontWeight: 500,
                borderRadius: 2,
                zIndex: 1,
                boxSizing: 'border-box',
              }}
            />
            <span 
              style={{ 
                position: 'relative', 
                zIndex: 2, 
                paddingLeft: 6,
                paddingRight: 6,
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0, // Allow text to shrink
                flexShrink: 1 // Allow this text to shrink
              }}
              title={displayValue}
            >
              {displayValue}
            </span>
          </div>
          <span 
            className="bar-count" 
            style={{ 
              marginLeft: 8, 
              minWidth: 30, 
              textAlign: 'right', 
              color: '#999', 
              fontSize: 12, 
              flexShrink: 0 // Don't let the count shrink
            }}
          >
            {abbreviateNumber(count)}
          </span>
        </>
      ) : (
        <input
          ref={otherInputRef}
          type="text"
          value={otherInputValue}
          onChange={e => setOtherInputValue(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => {
            if (e.key === 'Enter' && otherInputValue.trim()) {
              addFilter(columnName, otherInputValue.trim());
              setOtherInputValue("");
              setTimeout(() => setShowOtherInput(false), 0);
            } else if (e.key === 'Escape') {
              setShowOtherInput(false);
              setOtherInputValue("");
            }
          }}
          style={{ 
            flex: 1,
            fontSize: 14, 
            padding: '2px 6px', 
            borderRadius: 4, 
            border: '1px solid #ccc',
            minWidth: 0
          }}
          placeholder="Type value..."
        />
      )}
    </div>
  );
};

export default OtherValues;
