import React, { useState, useCallback } from "react";
import Explorer from "./Explorer";
import { WasmDatabase } from "../../src/WasmDatabase";

function AppWasm() {
  const [database, setDatabase] = useState<WasmDatabase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadFile = async (file: File) => {
    if (!file.name.endsWith('.db') && !file.name.endsWith('.duckdb')) {
      setError('Please upload a DuckDB file (.db or .duckdb)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const wasmDb = new WasmDatabase();
      await wasmDb.loadFile(file);
      setDatabase(wasmDb);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load database file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await loadFile(file);
  };

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    const duckdbFile = files.find(file => 
      file.name.endsWith('.db') || file.name.endsWith('.duckdb')
    );
    
    if (duckdbFile) {
      await loadFile(duckdbFile);
    } else {
      setError('Please drop a DuckDB file (.db or .duckdb)');
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    // Only set dragOver to false if we're leaving the drop zone completely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  if (error && !database) {
    return (
      <div 
        className="App"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          minHeight: '100vh',
          backgroundColor: isDragOver ? '#f0f8ff' : 'white',
          border: isDragOver ? '3px dashed #007acc' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <header className="header">
          <h1>DuckDB Explorer (WASM)</h1>
        </header>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ color: 'red', marginBottom: '20px' }}>
            Error: {error}
          </div>
          <button 
            onClick={() => { setError(null); setDatabase(null); }}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
          <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            Or drop a DuckDB file anywhere on this page
          </div>
        </div>
      </div>
    );
  }

  if (!database) {
    return (
      <div 
        className="App"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        style={{
          minHeight: '100vh',
          backgroundColor: isDragOver ? '#f0f8ff' : 'white',
          border: isDragOver ? '3px dashed #007acc' : 'none',
          transition: 'all 0.2s ease',
          position: 'relative'
        }}
      >
        <header className="header">
          <h1>DuckDB Explorer (WASM)</h1>
        </header>
        
        {isLoading && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '20px 40px',
              borderRadius: '8px',
              fontSize: '18px'
            }}>
              Loading database...
            </div>
          </div>
        )}
        
        {isDragOver && (
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#007acc',
            backgroundColor: 'white',
            padding: '20px 40px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 100
          }}>
            Drop your DuckDB file here
          </div>
        )}
        
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          <div style={{ marginBottom: '30px' }}>
            <h2>Upload DuckDB File</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              Drop a DuckDB database file anywhere on this page, or use the file picker below.
              All processing happens locally - no data is sent to any server.
            </p>
          </div>
          
          <div style={{
            border: '2px dashed #ccc',
            borderRadius: '8px',
            padding: '40px',
            backgroundColor: '#f9f9f9'
          }}>
            <input
              type="file"
              accept=".db,.duckdb"
              onChange={handleFileUpload}
              disabled={isLoading}
              style={{
                padding: '10px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: 'white',
                opacity: isLoading ? 0.5 : 1
              }}
            />
            <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
              Supported formats: .db, .duckdb
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <Explorer database={database} />;
}

export default AppWasm;