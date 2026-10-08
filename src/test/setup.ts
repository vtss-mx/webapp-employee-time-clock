import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';
import { activate } from '../i18n/core';
import esMX from '../i18n/locales/es-MX';
import { forgetServerTexts } from '../i18n/serverTexts';
import { publishCatalogs } from '../utils/catalogs';
import { testSession } from './http';
import { installSpeechSynthesis, resetSpeech } from './speechSynthesis';

// Las pruebas corren en es-MX (el idioma por omisión), ya cargado antes de importar la app. Una
// prueba en en-US lo cambia con `setLocale('en-US')` y al terminar se regresa a es-MX.
activate('es-MX', esMX);

// Margen para equipos cargados (la suite corre en paralelo): las esperas de findBy/waitFor no
// deben depender de la velocidad de la máquina.
configure({ asyncUtilTimeout: 4000 });

// jsdom no implementa el desplazamiento de elementos (listas con opción activa visible).
Element.prototype.scrollIntoView ??= function scrollIntoView() {};

// jsdom no trae la síntesis de voz: se simula para probar la guía por voz (qué se leyó, silencio, sin soporte).
installSpeechSynthesis();

afterEach(() => {
  cleanup();
  activate('es-MX', esMX);
  // Cada prueba empieza sin catálogos vigentes ni textos del servidor recordados (los deja una prueba anterior).
  publishCatalogs(null);
  forgetServerTexts();
  testSession.signedIn = false;
  window.history.replaceState(null, ''); // la marca de recarga vive en history.state
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSpeech(); // restablece la síntesis simulada (soporte, voces y lo dicho) para la siguiente prueba
});
