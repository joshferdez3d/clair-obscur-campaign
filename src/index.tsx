import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { FirestoreService } from './services/firestoreService';

// Initialize sample data for development
// if (process.env.NODE_ENV === 'development') {
//   FirestoreService.initializeSampleData().catch(console.error);
// }

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
