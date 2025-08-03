import React from "react";
import { TabState } from './Tab';

interface TabBarProps {
  tabs: TabState[];
  selectedTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddTab: () => void;
  onTabRename: (tabId: string, newName: string) => void;
}


const TabBar: React.FC<TabBarProps> = ({ tabs, selectedTabId, onTabClick, onTabClose, onAddTab, onTabRename }) => {
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string>("");

  const handleTabNameClick = (tab: TabState, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingName(tab.name || tab.queryState.query.tableName || "Untitled");
  };

  const handleNameSubmit = (tabId: string) => {
    if (editingName.trim()) {
      onTabRename(tabId, editingName.trim());
    }
    setEditingTabId(null);
    setEditingName("");
  };

  const handleKeyPress = (e: React.KeyboardEvent, tabId: string) => {
    if (e.key === 'Enter') {
      handleNameSubmit(tabId);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingName("");
    }
  };

  return (
    <div
      className="tab-bar"
      style={{
        display: "flex",
        background: "#f8f9fa",
        borderBottom: "1px solid #e0e0e0",
        alignItems: "center",
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
          {editingTabId === tab.id ? (
            <input
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={() => handleNameSubmit(tab.id)}
              onKeyDown={(e) => handleKeyPress(e, tab.id)}
              autoFocus
              style={{
                background: "transparent",
                border: "1px solid #ccc",
                borderRadius: "2px",
                padding: "2px 4px",
                fontSize: "inherit",
                fontFamily: "inherit",
                minWidth: "80px",
              }}
            />
          ) : (
            <span 
              onDoubleClick={(e) => handleTabNameClick(tab, e)}
              style={{ cursor: "text" }}
            >
              {tab.name || tab.queryState.query.tableName || "Untitled"}
            </span>
          )}
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
      <button
        style={{
          marginLeft: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#333",
          fontSize: 22,
          padding: "0 0.5rem",
        }}
        aria-label="Add new tab"
        onClick={onAddTab}
      >
        +
      </button>
    </div>
  );
};




export default TabBar;
