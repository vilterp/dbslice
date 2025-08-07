import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppWasm from './AppWasm';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <AppWasm />
  </React.StrictMode>
);