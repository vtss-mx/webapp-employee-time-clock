import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { CatalogProvider } from '../context/CatalogContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import { AppRouter } from '../routes/AppRouter';
import { catalogsFixture } from '../test/catalogs';
import { apiFail, apiOk, mockFetch, testSession } from '../test/http';
import { tokenResponse, WithCatalogs } from '../test/render';
import type { EmployeeFormValues } from '../types';
import { EmployeeFormFields } from './EmployeeForm';
import { emptyEmployeeForm } from '../utils/formRules';

describe('EmployeeFormFields: normaliza mientras se escribe', () => {
  function Harness() {
    const [values, setValues] = useState<EmployeeFormValues>(emptyEmployeeForm);
    const [touched, setTouched] = useState<string[]>([]);
    return (
      <>
        <EmployeeFormFields values={values} errors={{}} onChange={setValues} onTouch={(f) => setTouched((t) => [...t, f])} />
        <output>{JSON.stringify(values)}</output>
        <span data-testid="touched">{touched.join(',')}</span>
      </>
    );
  }

  it('RFC/CURP en mayúsculas sin guiones, NSS solo dígitos y teléfono agrupado', async () => {
    render(<Harness />, { wrapper: WithCatalogs });
    await userEvent.type(screen.getByLabelText('CURP'), 'hegg-560427-mvzrrl04-extra');
    await userEvent.type(screen.getByLabelText('RFC'), 'pegj 900515 ab1');
    await userEvent.type(screen.getByLabelText('No. de Seguridad Social (NSS)'), '1234-5678-903-99');
    await userEvent.type(screen.getByLabelText('Teléfono celular'), '(662) 123-4567');
    const values = JSON.parse(document.querySelector('output')?.textContent ?? '{}') as EmployeeFormValues;
    expect(values).toMatchObject({ curp: 'HEGG560427MVZRRL04', rfc: 'PEGJ900515AB1', nss: '12345678903', phone: '+526621234567' });
    expect(screen.getByLabelText('Teléfono celular')).toHaveValue('662 123 4567');
    expect(screen.getByTestId('touched').textContent).toContain('curp'); // al salir del campo
    // Obligatorios: asterisco rojo por CSS (no forma parte del texto de la etiqueta). RFC, CURP y NSS son opcionales.
    expect(screen.getByText('Nombres').closest('label')).toHaveClass('is-required');
    for (const label of ['CURP', 'RFC', 'No. de Seguridad Social (NSS)']) {
      expect(screen.getByText(label).closest('label')).not.toHaveClass('is-required');
      expect(screen.getByLabelText(label)).not.toBeRequired();
    }
    expect(screen.getByText('Opcional · 13 caracteres. Debe coincidir con la fecha de nacimiento')).toBeInTheDocument();
  });
});

describe('EmployeeFormFields: cuentas de personas en varias empresas', () => {
  const values = { ...emptyEmployeeForm, email: 'ana@empresa.com', phone: '+526621234567' };

  it('al vincular a una persona de otra empresa no pide contraseña (conserva la suya)', () => {
    const linkable = { status: 'linkable' as const, message: 'Esta persona ya tiene cuenta en Employee Time Clock' };
    render(<EmployeeFormFields values={values} errors={{}} onChange={vi.fn()} live={{ email: linkable }} linking />, { wrapper: WithCatalogs });
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    expect(screen.getByText('Esta persona ya tiene cuenta en Employee Time Clock')).toBeInTheDocument();
  });

  it('cuenta compartida: correo, teléfono y contraseña bloqueados en la edición', () => {
    render(<EmployeeFormFields values={values} errors={{}} onChange={vi.fn()} isEdit accountLocked />, { wrapper: WithCatalogs });
    expect(screen.getByLabelText('Correo electrónico')).toBeDisabled();
    expect(screen.getByLabelText('Teléfono celular')).toBeDisabled();
    expect(screen.queryByLabelText('Nueva contraseña')).toBeNull();
    expect(screen.getAllByText(/Cuenta compartida con otra empresa/)).toHaveLength(2);
  });
});

describe('rutas con carga diferida y guardas', () => {
  const app = (route: string) =>
    render(
      <MemoryRouter initialEntries={[route]}>
        <FeedbackProvider>
          <AuthProvider>
            <CatalogProvider>
              <AppRouter />
            </CatalogProvider>
          </AuthProvider>
        </FeedbackProvider>
      </MemoryRouter>,
    );

  it('sin sesión, una ruta protegida lleva al login (cargado bajo demanda)', async () => {
    mockFetch(apiFail(401, 'SESSION_INVALID'));
    app('/company/employees');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('con sesión, /login (solo invitados) lleva al inicio del rol', async () => {
    testSession.signedIn = true;
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/auth/refresh')) return apiOk(tokenResponse());
      return call.url.endsWith('/catalogs') ? apiOk(catalogsFixture) : apiOk({ items: [], total: 0, page: 1, size: 20 });
    });
    app('/login');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).toBeNull());
    expect(await screen.findByLabelText('Navegación principal', {}, { timeout: 4000 })).toBeInTheDocument(); // ya dentro de la app
    expect(screen.getByText('Empleado', { selector: '.sidebar__section' })).toBeInTheDocument(); // rol del catálogo
    expect(calls.filter((c) => c.url.endsWith('/catalogs'))).toHaveLength(1); // una sola carga por sesión
  });
});
