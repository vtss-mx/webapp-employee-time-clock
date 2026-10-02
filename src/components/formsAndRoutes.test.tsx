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
import { apiFail, apiOk, mockFetch } from '../test/http';
import { tokenResponse, WithCatalogs } from '../test/render';
import { preferenceStore } from '../utils/storage';
import type { EmployeeFormValues } from '../types';
import { emptyEmployeeForm, EmployeeFormFields } from './EmployeeForm';
import { ReverifyIdentityModal } from './ReverifyIdentityModal';

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
    // Obligatorios: asterisco rojo por CSS (no forma parte del texto de la etiqueta).
    expect(screen.getByText('CURP').closest('label')).toHaveClass('is-required');
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

describe('ReverifyIdentityModal', () => {
  it('envía el motivo elegido (catálogo reverification_reasons) o escrito; sin motivo, undefined', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<ReverifyIdentityModal open firstName="Ana" busy={false} onCancel={onCancel} onConfirm={onConfirm} />, {
      wrapper: WithCatalogs,
    });
    expect(screen.getByRole('button', { name: 'Actualización periódica de identidad' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Solicitar nueva verificación de identidad' })).toHaveTextContent('Ana deberá registrar su rostro');
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    expect(onConfirm).toHaveBeenLastCalledWith(undefined);

    await userEvent.click(screen.getByRole('button', { name: 'Cambio importante de apariencia' }));
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    expect(onConfirm).toHaveBeenLastCalledWith('Cambio importante de apariencia');

    await userEvent.clear(screen.getByLabelText('Motivo (opcional, visible para el empleado)'));
    await userEvent.type(screen.getByLabelText('Motivo (opcional, visible para el empleado)'), '  Revisión anual  ');
    await userEvent.click(screen.getByRole('button', { name: 'Solicitar verificación' }));
    expect(onConfirm).toHaveBeenLastCalledWith('Revisión anual');

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    rerender(<ReverifyIdentityModal open firstName="Ana" busy onCancel={onCancel} onConfirm={onConfirm} />);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
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
    preferenceStore.set('tc.signed-in', '1');
    const { calls } = mockFetch((call) => {
      if (call.url.endsWith('/auth/refresh')) return apiOk(tokenResponse());
      return call.url.endsWith('/catalogs') ? apiOk(catalogsFixture) : apiOk({ items: [], total: 0, page: 1, size: 20 });
    });
    app('/login');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Iniciar sesión' })).toBeNull());
    expect(await screen.findByLabelText('Navegación principal', {}, { timeout: 4000 })).toBeInTheDocument(); // ya dentro de la app
    expect(screen.getByText('Employee', { selector: '.sidebar__section' })).toBeInTheDocument(); // rol del catálogo
    expect(calls.filter((c) => c.url.endsWith('/catalogs'))).toHaveLength(1); // una sola carga por sesión
  });
});
