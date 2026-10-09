import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '../style.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The React root element was not found.');
}

createRoot(rootElement).render(<App />);
