import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { purgeLegacyUserData } from './utils/storage';

// Los datos de usuario viven en la BD: se borran las copias que dejaron versiones anteriores.
purgeLegacyUserData();

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
