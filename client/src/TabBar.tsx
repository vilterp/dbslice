import React from "react";
import { TabState } from './Tab';

interface TabBarProps {
  tabs: TabState[];
  selectedTabId: string | null;
  tables: Array<{ table_name: string }>;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddTab: (tableName: string) => void;
  onTabRename: (tabId: string, newName: string) => void;
}


const TabBar: React.FC<TabBarProps> = ({ tabs, selectedTabId, tables, onTabClick, onTabClose, onAddTab, onTabRename }) => {
  const [editingTabId, setEditingTabId] = React.useState<string | null>(null);
  const [editingName, setEditingName] = React.useState<string>("");
  const [showTableSelector, setShowTableSelector] = React.useState(false);
  const tableSelectorRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableSelectorRef.current && !tableSelectorRef.current.contains(event.target as Node)) {
        setShowTableSelector(false);
      }
    };

    if (showTableSelector) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showTableSelector]);

  const handleAddTabClick = () => {
    setShowTableSelector(!showTableSelector);
  };

  const handleTableSelect = (tableName: string) => {
    onAddTab(tableName);
    setShowTableSelector(false);
  };

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
        cursor: "pointer",
        minHeight: "2.25rem",
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={tab.id === selectedTabId ? "tab active" : "tab"}
          style={{
            padding: "0.5rem 0.5rem 0.5rem 1rem",
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
              style={{ cursor: "default" }}
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
              borderRadius: "50%",
              width: 20,
              height: 20,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.15)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
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
      <div style={{ position: "relative" }} ref={tableSelectorRef}>
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
          onClick={handleAddTabClick}
        >
          +
        </button>

        {showTableSelector && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              zIndex: 1000,
              minWidth: "200px",
              maxHeight: "300px",
              overflowY: "auto",
              marginTop: "4px",
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                fontWeight: "bold",
                borderBottom: "1px solid #e0e0e0",
                background: "#f8f9fa",
              }}
            >
              Select a table
            </div>
            {tables.map((table) => (
              <div
                key={table.table_name}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: "1px solid #f0f0f0",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#f0f0f0";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "white";
                }}
                onClick={() => handleTableSelect(table.table_name)}
              >
                {table.table_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};




export default TabBar;
