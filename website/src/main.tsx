import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root is missing from index.html.');
}

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The build prerenders every route, so in production the root already holds
// markup and must be hydrated - createRoot would discard it and repaint. The
// dev server serves an empty root, where hydration has nothing to attach to.
if (container.hasChildNodes()) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
