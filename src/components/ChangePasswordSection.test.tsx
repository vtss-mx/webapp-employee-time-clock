import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { apiFail, apiOk, jsonResponse, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import { ChangePasswordSection } from './ChangePasswordSection';
import { Panel, PanelFooter, PanelGrid, PanelHeader, PanelHero, PanelSection } from './ui/Panel';

async function fill(current: string, next: string, confirm = next) {
  await userEvent.type(screen.getByLabelText('Contraseña actual'), current);
  await userEvent.type(screen.getByLabelText('Nueva contraseña'), next);
  await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), confirm);
  await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
}

/** Responde la confirmación previa al cambio ("Cambiar contraseña" o "Cancelar"). */
async function answer(button: 'Cambiar contraseña' | 'Cancelar') {
  const dialog = await screen.findByRole('alertdialog', { name: '¿Cambiar tu contraseña?' });
  await userEvent.click(within(dialog).getByRole('button', { name: button }));
  return dialog;
}

describe('ChangePasswordSection', () => {
  it('valida en el cliente antes de enviar', async () => {
    const { fn } = mockFetch(apiOk({ revoked_sessions: 0 }));
    renderWithProviders(<ChangePasswordSection />);
    const button = screen.getByRole('button', { name: 'Actualizar contraseña' });
    expect(button).toBeDisabled(); // vacío: no se puede enviar
    await fill('Actual123', 'corta', 'otra');
    await userEvent.tab(); // salir del último campo
    // El botón sigue deshabilitado y cada campo muestra su error al salir de él.
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription('Mínimo 8 caracteres');
    expect(screen.getByLabelText('Confirmar nueva contraseña')).toHaveAccessibleDescription('Las contraseñas no coinciden');
    expect(fn).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText('Nueva contraseña'));
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave1');
    await userEvent.clear(screen.getByLabelText('Confirmar nueva contraseña'));
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaClave1');
    expect(button).toBeEnabled();
  });

  it('cambia la contraseña e informa las sesiones cerradas', async () => {
    const onChanged = vi.fn();
    const { calls } = mockFetch(apiOk({ revoked_sessions: 2 }, { code: 'PASSWORD_CHANGED' }));
    renderWithProviders(<ChangePasswordSection onChanged={onChanged} />);
    await fill('Actual123', 'NuevaClave1');
    // Se confirma antes: qué pasa con las demás sesiones. Cancelar no envía nada ni borra lo escrito.
    expect(await answer('Cancelar')).toHaveTextContent('Se cerrará tu sesión en tus otros dispositivos.');
    expect(calls).toHaveLength(0);
    expect(screen.getByLabelText('Nueva contraseña')).toHaveValue('NuevaClave1');
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await answer('Cambiar contraseña');
    expect(await screen.findByText('Se cerró la sesión en 2 dispositivos más.')).toBeInTheDocument();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ current_password: 'Actual123', new_password: 'NuevaClave1' });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    // La sección sigue en pantalla: se libera para volver a usarse y sin errores de lo anterior.
    expect(screen.getByLabelText('Contraseña actual')).toBeEnabled();
    expect(screen.getByLabelText('Contraseña actual')).not.toHaveAccessibleDescription();
  });

  it('muestra los errores del servidor en el campo correcto', async () => {
    mockFetch(apiFail(422, 'CURRENT_PASSWORD_INVALID', 'La contraseña actual no es correcta'));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Mala1234', 'NuevaClave1');
    await answer('Cambiar contraseña');
    const popup = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar la contraseña' });
    expect(popup).toHaveTextContent('La contraseña actual no es correcta');
    expect(screen.getByLabelText('Contraseña actual')).toHaveAccessibleDescription('La contraseña actual no es correcta');
  });

  it('errores de validación del backend y fallas inesperadas', async () => {
    mockFetch(
      jsonResponse(
        {
          success: false,
          statusCode: 422,
          code: 'VALIDATION_ERROR',
          message: 'm',
          data: null,
          errors: [{ code: 'value_error', message: 'Contraseña común', field: 'new_password', details: null }],
          traceId: 't',
          timestamp: 'x',
        },
        422,
      ),
    );
    renderWithProviders(<ChangePasswordSection />);
    await fill('Actual123', 'NuevaClave1');
    await answer('Cambiar contraseña');
    const first = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar la contraseña' });
    expect(within(first).getByText('Contraseña común')).toBeInTheDocument(); // detalle por campo
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription('Contraseña común');
    await userEvent.click(within(first).getByRole('button', { name: 'Entendido' }));

    mockFetch(apiFail(503, 'SERVER_BUSY', 'Ocupado'));
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await answer('Cambiar contraseña');
    const second = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar la contraseña' });
    expect(second).toHaveTextContent('Ocupado');
  });
});

describe('ChangePasswordSection: casos límite', () => {
  it('la nueva contraseña debe ser distinta de la actual', async () => {
    mockFetch(apiOk({ revoked_sessions: 0 }));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Actual123', 'Actual123');
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription('Debe ser distinta de la actual');
    expect(screen.getByRole('button', { name: 'Actualizar contraseña' })).toBeDisabled();
  });

  it('un envío sin el botón (p. ej. un gestor de contraseñas) con campos inválidos marca los errores y no llama al servidor', async () => {
    const { fn } = mockFetch(apiOk({ revoked_sessions: 0 }));
    renderWithProviders(<ChangePasswordSection />);
    fireEvent.submit(screen.getByLabelText('Contraseña actual').closest('form') as HTMLFormElement);
    const popup = await screen.findByRole('alertdialog', { name: 'Revisa los datos' });
    expect(popup).toHaveTextContent('Escribe tu contraseña actual');
    expect(screen.getByLabelText('Contraseña actual')).toHaveAccessibleDescription('Escribe tu contraseña actual');
    expect(fn).not.toHaveBeenCalled();
  });

  it('sin otras sesiones abiertas: avisa que la sesión actual sigue activa', async () => {
    mockFetch(apiOk({ revoked_sessions: 0 }));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Actual123', 'NuevaClave1');
    await answer('Cambiar contraseña');
    expect(await screen.findByText('Tu sesión actual sigue activa.')).toBeInTheDocument();
  });

  it('una sola sesión cerrada: el aviso va en singular', async () => {
    mockFetch(apiOk({ revoked_sessions: 1 }));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Actual123', 'NuevaClave1');
    await answer('Cambiar contraseña');
    expect(await screen.findByText('Se cerró la sesión en 1 dispositivo más.')).toBeInTheDocument();
  });
});

describe('ChangePasswordSection en inglés (en-US)', () => {
  it('etiquetas, confirmación abierta al cambiar el idioma y aviso de éxito en inglés', async () => {
    mockFetch(apiOk({ revoked_sessions: 1 }));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Actual123', 'NuevaClave1');
    // La confirmación ya abierta sigue al idioma (cambio en caliente), sin perder lo escrito.
    await screen.findByRole('alertdialog', { name: '¿Cambiar tu contraseña?' });
    await act(() => setLocale('en-US'));
    const dialog = screen.getByRole('alertdialog', { name: 'Change your password?' });
    expect(dialog).toHaveTextContent('You will be signed out of your other devices.');
    expect(screen.getByLabelText('Current password')).toHaveValue('Actual123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change password' }));
    const done = await screen.findByRole('dialog', { name: 'Password updated' });
    expect(done).toHaveTextContent('You were signed out of 1 other device.');
    expect(screen.getByRole('heading', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAccessibleDescription('At least 8 characters, with an uppercase letter, a lowercase letter, and a number');
  });
});

describe('Panel (contenedor único)', () => {
  it('agrupa encabezado, secciones y pie en un solo contenedor (o formulario)', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const { container } = renderWithProviders(
      <Panel onSubmit={onSubmit}>
        <PanelHeader title="Título" backTo="/" />
        <PanelHero eyebrow="Ceja" title="Hero" />
        <PanelGrid>
          <PanelSection title="A" aside={<span>extra</span>}>
            uno
          </PanelSection>
          <PanelSection>dos</PanelSection>
        </PanelGrid>
        <PanelFooter align="between">
          <button type="submit">Guardar</button>
        </PanelFooter>
      </Panel>,
    );
    expect(container.querySelectorAll('.panel')).toHaveLength(1);
    expect(container.querySelector('form.panel')).not.toBeNull();
    expect(screen.getByText('extra')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    renderWithProviders(<Panel>contenido</Panel>);
    expect(screen.getByText('contenido').tagName).toBe('DIV');
  });
});
