import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { purgeLegacyStorage } from './utils/legacyStorage';

// La app no usa Web Storage: se borra lo que dejaron versiones anteriores.
purgeLegacyStorage();

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
