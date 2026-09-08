import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './i18n';
import './theme/themes.css';
import 'katex/dist/katex.min.css';

// Default to dark theme on first paint to avoid the light-flash race.
document.documentElement.setAttribute('data-theme', 'dark');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
