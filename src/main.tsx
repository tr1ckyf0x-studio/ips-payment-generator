import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/index.ts';
import { App } from './App.tsx';
import './index.css';

/**
 * Clears the key this app wrote before it stopped remembering the payer.
 *
 * Anyone who used an earlier version still has a name and address sitting in their
 * browser. Nothing writes the key now and nothing else would ever remove it, so it is
 * removed here, once, on load. Safe to delete this after a while.
 */
try {
  localStorage.removeItem('nalog-za-uplatu.payer');
} catch {
  // Private mode and blocked site data both throw on access; there is nothing to do.
}

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
