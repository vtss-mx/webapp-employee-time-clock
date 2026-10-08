import { act, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as versionService from '../services/versionService';
import { say } from '../test/fakeApi/core';
import { describeIssues, languageIssues } from '../test/language';
import { exemptions, renderScreen, screenCases, settle, visibleTexts, type Rendered } from '../test/screenHarness';
import { DEFAULT_LOCALE, LOCALES, setLocale, t, type Locale } from './core';

/**
 * Guardián del cambio de idioma EN CALIENTE (regla 16: «todo en caliente, también lo que envía el servidor»), en
 * CADA ruta de `SCREEN_VIEWS`: con la pantalla cargada en es-MX, algo escrito en un campo y un popup abierto (la
 * confirmación o el aviso del formulario, el error que el servidor respondió al guardar o la confirmación de
 * «Cerrar sesión»), el idioma cambia a en-US, a uno de los demás idiomas (cada ruta uno distinto, por turnos: así los
 * siete participan sin multiplicar por siete el tiempo de la suite; `screensLanguage` ya dibuja cada ruta en cada
 * idioma) y de regreso a es-MX, y en cada paso:
 * - no queda NADA del otro idioma: textos de la app, formatos, catálogos, menú, los datos del servidor (se vuelven
 *   a pedir en su lugar) y el popup abierto, también el mensaje del servidor (`i18n` del sobre);
 * - nada se reinicia ni se recarga: el mismo popup abierto, lo escrito sigue ahí, la misma ruta y ninguna recarga.
 */
/** Los idiomas que no son el de omisión ni el inglés: cada ruta prueba uno, por turnos. */
const OTHERS = LOCALES.filter((locale) => locale !== DEFAULT_LOCALE && locale !== 'en-US');
/** La ruta, su caso y los idiomas por los que pasa antes de volver a es-MX. */
const CASES = screenCases().map((screen, index) => {
  const extra = OTHERS.length ? [OTHERS[index % OTHERS.length]] : [];
  return [screen.route, screen, ['en-US', ...extra, DEFAULT_LOCALE] as Locale[]] as const;
});

/** Mensaje del servidor al fallar cualquier escritura: queda abierto en el popup de error. */
const CONFLICT = say({ 'es-MX': 'Ya existe un registro con esos datos', 'en-US': 'A record with that data already exists', 'pt-BR': 'Já existe um registro com esses dados', 'fr-FR': 'Un enregistrement avec ces données existe déjà', 'de-DE': 'Ein Datensatz mit diesen Daten existiert bereits', 'it-IT': 'Esiste già un record con questi dati', 'es-ES': 'Ya existe un registro con esos datos' });

const openDialog = () => document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]');

/** Abre un popup como lo haría la persona: enviar el formulario (y confirmar) o «Cerrar sesión». */
async function openPopup(rendered: Rendered): Promise<HTMLElement | null> {
  const submit = [...document.querySelectorAll<HTMLButtonElement>('form button[type="submit"]')].find((button) => !button.disabled);
  if (!openDialog() && submit) {
    fireEvent.click(submit);
    await settle(rendered.backend);
    const confirm = openDialog()?.classList.contains('msg--confirm') ? openDialog()?.querySelector<HTMLButtonElement>('[data-primary]:not([disabled])') : null;
    if (confirm) {
      fireEvent.click(confirm);
      await settle(rendered.backend);
    }
  }
  const logout = document.querySelector<HTMLButtonElement>(`button[aria-label="${t('common.actions.logout')}"]`);
  if (!openDialog() && logout) {
    fireEvent.click(logout);
    await settle(rendered.backend);
  }
  return openDialog();
}

/** El primer campo donde se escribe (texto, correo, búsqueda...). */
const firstField = () =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:is([type="text"], [type="email"], [type="search"], [type="tel"], :not([type])):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])');

/** Lo que se escribe en el primer campo (un dato: no es de ningún idioma). */
const TYPED = 'Acme 77';

async function expectOnly(locale: Locale, rendered: Rendered) {
  const issues = await languageIssues(visibleTexts(), locale, [TYPED, ...exemptions(rendered.backend, locale)]);
  expect(describeIssues(issues), `queda texto que no es ${locale}`).toEqual([]);
}

describe('cambio de idioma en caliente en cada pantalla', () => {
  it.each(CASES)('%s', async (_, screen, steps) => {
    const reload = vi.spyOn(versionService, 'reloadApp');
    const rendered = await renderScreen(screen, 'es-MX', { failWrites: CONFLICT });
    const field = firstField();
    if (field) fireEvent.change(field, { target: { value: TYPED } });
    // Lo que el campo dejó (uno de números o de horas filtra las letras): eso debe seguir ahí después.
    const typed = field?.value;
    const dialog = await openPopup(rendered);
    await expectOnly('es-MX', rendered);

    for (const locale of steps) {
      await act(() => setLocale(locale));
      await settle(rendered.backend);
      await expectOnly(locale, rendered);
      // Nada se reinicia: el mismo popup sigue abierto, lo escrito sigue ahí y la pantalla es la misma.
      if (dialog) expect(openDialog(), 'el popup abierto se cerró o se volvió a abrir').toBe(dialog);
      if (field?.isConnected) expect(field.value, 'lo escrito se perdió').toBe(typed);
      expect(rendered.path()).toBe(screen.path);
    }
    expect(reload).not.toHaveBeenCalled();
    expect([...rendered.backend.unhandled]).toEqual([]);
  });
});
