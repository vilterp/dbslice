import React from 'react';

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
      style={{ display: 'flex', alignItems: 'center', minHeight: 24, cursor: 'pointer', outline: 'none' }}
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
          <span style={{ position: 'relative', zIndex: 2 }}>{displayValue}</span>
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
          style={{ marginLeft: 8, fontSize: 14, padding: '2px 6px', borderRadius: 4, border: '1px solid #ccc', minWidth: 80 }}
          placeholder="Type value..."
        />
      )}
    </div>
  );
};

export default OtherValues;
