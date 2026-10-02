import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { LoginPage } from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import { WithCatalogs } from '../test/render';
import { ChangePasswordSection } from './ChangePasswordSection';
import { emptyEmployeeForm, EmployeeFormFields } from './EmployeeForm';

/**
 * Chrome adivina el tipo de cada campo por su etiqueta. Con estas reglas (tomadas de Chromium,
 * `components/autofill/core/common/autofill_regex_constants.cc`) un campo se toma como tarjeta
 * de pago y, en http://, muestra en rojo "Automatic payment methods filling is disabled...".
 * Ninguna etiqueta de la app debe activarlas.
 */
const CARD_NUMBER = /(add)?(?:card|cc|acct).?(?:number|#|no|num|field)|(?<!telefon|haus|person|fødsels|kunden)nummer|(numero|número|numéro)(?!.*(document|fono|phone|réservation))/i;
const CARD_HOLDER = /card holder|name.*\bon\b.*card|cc.?name|cc.?full.?name|owner|karteninhaber|nombre.*tarjeta|nom.*carte/i;
const CVC = /verification|card.?identification|security.?code|card.?code|security.?value|security.?number|card.?pin|c-v-v|código de segurança|codigo de seguranca|cvc|cvv|cvd|cid|ccv/i;

function labels(container: HTMLElement): string[] {
  return [...container.querySelectorAll('input, textarea')].map((input) => {
    const label = input.id ? container.querySelector(`label[for="${CSS.escape(input.id)}"]`) : null;
    return (label?.textContent ?? input.getAttribute('aria-label') ?? '').trim();
  });
}

describe('etiquetas a salvo del autollenado de tarjetas de Chrome', () => {
  it.each([
    ['alta/edición de empleado', <EmployeeFormFields values={emptyEmployeeForm} errors={{}} onChange={() => undefined} />],
    ['inicio de sesión', <AuthProvider><LoginPage /></AuthProvider>],
    ['cambio de contraseña', <ChangePasswordSection />],
  ])('%s', (_, ui) => {
    const { container } = render(
      <MemoryRouter>
        <FeedbackProvider>
          <WithCatalogs>{ui}</WithCatalogs>
        </FeedbackProvider>
      </MemoryRouter>,
    );
    const found = labels(container);
    expect(found.length).toBeGreaterThan(0);
    for (const label of found) {
      expect(label, `"${label}" parece campo de tarjeta para Chrome`).not.toMatch(CARD_NUMBER);
      expect(label).not.toMatch(CARD_HOLDER);
      expect(label).not.toMatch(CVC);
    }
  });

  it('las reglas detectan el caso que Chrome marcaba', () => {
    expect('Número de empleado').toMatch(CARD_NUMBER);
    expect('No. de empleado').not.toMatch(CARD_NUMBER);
  });
});
