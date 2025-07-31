import React, { useState } from "react";
import "./SidePanel.css";

interface SidePanelProps {
  selectedRow: any | null;
  onClose: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({ selectedRow, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 150);
  };

  if (!selectedRow) return null;

  return (
    <div className="detail-panel-overlay" onClick={handleClose}>
      <div className={`detail-panel ${isClosing ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="detail-panel-header">
          <h3>Row Details</h3>
          <button className="close-button" onClick={handleClose}>×</button>
        </div>
        <div className="detail-panel-content">
          {Object.entries(selectedRow).map(([key, value]) => (
            <div key={key} className="detail-row">
              <div className="detail-label">
                {key}
                <button 
                  className="copy-button"
                  onClick={() => navigator.clipboard.writeText(String(value))}
                  title="Copy value"
                >
                  📋
                </button>
              </div>
              <div className="detail-value">{String(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SidePanel;