import React from "react";

interface TabBarProps {
  tabs: Array<{
    id: string;
    table: string;
  }>;
  selectedTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, selectedTabId, onTabClick, onTabClose }) => (
  <div
    className="tab-bar"
    style={{
      display: "flex",
      background: "#f8f9fa",
      borderBottom: "1px solid #e0e0e0",
    }}
  >
    {tabs.map((tab) => (
      <div
        key={tab.id}
        className={tab.id === selectedTabId ? "tab active" : "tab"}
        style={{
          padding: "0.5rem 1rem",
          borderRight: "1px solid #e0e0e0",
          background: tab.id === selectedTabId ? "white" : "inherit",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
        onClick={() => onTabClick(tab.id)}
      >
        <span>{tab.table}</span>
        <button
          style={{
            marginLeft: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#888",
            fontSize: 16,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onTabClose(tab.id);
          }}
          aria-label="Close tab"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);

export default TabBar;
