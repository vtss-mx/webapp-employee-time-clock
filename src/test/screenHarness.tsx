/**
 * Arnés de las pruebas del idioma por pantalla (regla 16): dibuja la APLICACIÓN COMPLETA (sesión, catálogos, menú,
 * pantalla y popups, como `App`) en una ruta de `SCREEN_VIEWS`, con el usuario del rol que la tiene y el backend
 * falso (`fakeApi`), espera a que termine de cargar y junta TODO el texto que se ve o se lee (texto visible y
 * `aria-label`, `title`, `placeholder`, `alt`...).
 */
import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { CatalogProvider } from '../context/CatalogContext';
import { AuthProvider } from '../context/AuthContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { setLocale, type Locale } from '../i18n/core';
import { LocaleSync } from '../i18n/LocaleSync';
import { AppRouter } from '../routes/AppRouter';
import { SCREEN_VIEWS } from '../routes/screens';
import type { User } from '../types';
import { endonymTexts } from '../i18n/endonyms';
import { fakeApiRoutes, type FakeWorld } from './fakeApi';
import { fakeBackend, type Texts } from './fakeApi/core';
import { mockFetch, testSession } from './http';
import { sampleUser } from './render';
import { withScreens } from './screens';

const base = { ...sampleUser, email: 'ana@acme.mx', preferences: { sidebar_collapsed: false, locale: null } };

/** Un usuario por rol y estado: cada pantalla se dibuja con quien la tiene (como lo envía el backend). */
export const USERS = {
  admin: withScreens({ ...base, id: 1, role: 'ADMIN', employee: null }),
  company: withScreens({ ...base, id: 2, role: 'COMPANY', employee: null, company: { id: 1, name: 'Acme', active: true } }),
  validator: withScreens({ ...base, id: 3, role: 'VALIDATOR', employee: null, company: { id: 1, name: 'Acme', active: true } }),
  employee: withScreens({ ...base, id: 7, company: { id: 1, name: 'Acme', active: true } }),
  enrolling: withScreens({ ...base, id: 8, employee: sampleUser.employee && { ...sampleUser.employee, face_status: 'NOT_ENROLLED' as const } }),
  pending: withScreens({ ...base, id: 9, employee: sampleUser.employee && { ...sampleUser.employee, face_status: 'PENDING_REVIEW' as const } }),
  multiCompany: withScreens({
    ...base,
    id: 10,
    memberships: [
      { id: 7, company: { id: 1, name: 'Acme', active: true }, active: true, face_status: 'APPROVED' as const },
      { id: 17, company: { id: 2, name: 'Globex', active: true }, active: true, face_status: 'APPROVED' as const },
    ],
  }),
} satisfies Record<string, User>;

/** Valor de cada parámetro de las rutas (un registro de los datos de prueba). */
const PARAMS: Record<string, string> = { id: '1', mode: 'enroll', role: 'employees', status: 'CONFIRMED', action: 'check-in', changeId: '2', adminId: '2', paymentId: '3', chargeId: '3' };

export interface ScreenCase {
  /** Código de la pantalla (`SCREEN_VIEWS`). */
  code: string;
  /** Plantilla de la ruta y la ruta concreta. */
  route: string;
  path: string;
  user: User;
}

/** Cada ruta de cada pantalla con el primer usuario que la tiene. */
export function screenCases(): ScreenCase[] {
  return Object.entries(SCREEN_VIEWS).flatMap(([code, view]) => {
    const user = Object.values(USERS).find((candidate) => candidate.screens.some((screen) => screen.code === code));
    if (!user) throw new Error(`Ningún usuario de prueba tiene la pantalla ${code}`);
    return view.routes.map(({ path: route }) => ({ code, route, user, path: route.replace(/:(\w+)/g, (_, name: string) => PARAMS[name]) }));
  });
}

/** Espera a que la pantalla termine de cargar: sin peticiones nuevas ni cambios en lo dibujado. */
export async function settle(backend: { requests: string[] }): Promise<void> {
  let last = '';
  let quiet = 0;
  for (let round = 0; round < 60 && quiet < 3; round++) {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 15));
    });
    const snapshot = `${backend.requests.length}|${document.body.innerHTML.length}`;
    quiet = snapshot === last && !document.querySelector('.page-loader, [aria-busy="true"]') ? quiet + 1 : 0;
    last = snapshot;
  }
}

/** Atributos con texto que se lee (lectores de pantalla) o se ve (globos, campos vacíos, imágenes). */
const TEXT_ATTRIBUTES = ['aria-label', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'aria-placeholder', 'title', 'placeholder', 'alt'];

/** Todo el texto visible y accesible de la página (también popups, que se montan en `body`), y el título. */
export function visibleTexts(root: HTMLElement = document.body): string[] {
  const texts: string[] = [document.title];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Un fragmento de código (una ruta, un ejemplo con curl, un stack trace) no es de ningún idioma.
    const parent = node.parentElement;
    if (parent && !parent.closest('script, style, noscript, template, code, pre, kbd, samp')) texts.push(node.textContent ?? '');
  }
  root.querySelectorAll('*').forEach((element) => {
    for (const name of TEXT_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value) texts.push(value);
    }
  });
  return texts.map((text) => text.trim()).filter(Boolean);
}

/** Nombres de meses y días del idioma (los escribe `Intl` en fechas abreviadas): son de ese idioma. */
export function calendarWords(locale: Locale): string[] {
  const words = new Set<string>();
  for (let month = 0; month < 12; month++) {
    const date = new Date(Date.UTC(2026, month, 5, 12));
    for (const style of ['long', 'short'] as const) words.add(new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' }).format(date).replace('.', ''));
  }
  for (let day = 0; day < 7; day++) {
    const date = new Date(Date.UTC(2026, 9, 4 + day, 12));
    for (const style of ['long', 'short', 'narrow'] as const) words.add(new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(date).replace('.', ''));
  }
  // También con mayúscula inicial («Lun», «Oct»): así los escriben los encabezados de un calendario.
  return [...words].flatMap((word) => [word, word.charAt(0).toLocaleUpperCase(locale) + word.slice(1)]);
}

export interface Rendered {
  backend: ReturnType<typeof fakeBackend>;
  world: FakeWorld;
  unmount: () => void;
  /** La ruta que se ve ahora (cambiar de idioma no navega). */
  path: () => string;
}

/** Lleva la cuenta de la ruta visible (el router en memoria no la pone en `window.location`). */
function PathProbe({ into }: { into: { path: string } }) {
  into.path = useLocation().pathname;
  return null;
}

/**
 * Dibuja la app en la ruta del caso, en `locale`, con su usuario y el backend falso; espera a que cargue.
 * `failWrites`: cada escritura falla con ese mensaje del servidor (prueba de un popup de error abierto).
 */
export async function renderScreen(screen: ScreenCase, locale: Locale, { failWrites }: { failWrites?: Texts } = {}): Promise<Rendered> {
  await setLocale(locale);
  const { routes, world } = fakeApiRoutes(screen.user);
  const backend = fakeBackend(routes, { failWrites });
  const probe = { path: screen.path };
  testSession.signedIn = true;
  mockFetch(backend.respond);
  vi.stubGlobal('scrollTo', () => undefined);
  const { unmount } = render(
    <MemoryRouter initialEntries={[screen.path]}>
      <FeedbackProvider>
        <AuthProvider>
          <LocaleSync />
          <CatalogProvider>
            <AppRouter />
            <PathProbe into={probe} />
          </CatalogProvider>
        </AuthProvider>
      </FeedbackProvider>
    </MemoryRouter>,
  );
  await settle(backend);
  return { backend, world, unmount, path: () => probe.path };
}

/**
 * Lo que no se revisa como texto de un idioma en la pantalla: los datos que escribió una persona (los que el
 * backend devuelve iguales en todos los idiomas), el nombre de cada idioma y su país en sí mismos (`ENDONYMS`, el
 * selector de idioma) y los nombres de meses y días que escribe `Intl` en ese idioma.
 */
export function exemptions(backend: Rendered['backend'], locale: Locale): string[] {
  return [...backend.data, ...endonymTexts(), ...calendarWords(locale)];
}
