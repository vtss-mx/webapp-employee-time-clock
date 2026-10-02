import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Margen para equipos cargados (la suite corre en paralelo): las esperas de findBy/waitFor no
// deben depender de la velocidad de la máquina.
configure({ asyncUtilTimeout: 4000 });

// jsdom no implementa el desplazamiento de elementos (listas con opción activa visible).
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
