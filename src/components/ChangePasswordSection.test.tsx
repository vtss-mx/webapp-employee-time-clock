import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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
    expect(await screen.findByText('Se cerró la sesión en 2 dispositivo(s) más.')).toBeInTheDocument();
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ current_password: 'Actual123', new_password: 'NuevaClave1' });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('muestra los errores del servidor en el campo correcto', async () => {
    mockFetch(apiFail(422, 'CURRENT_PASSWORD_INVALID', 'La contraseña actual no es correcta'));
    renderWithProviders(<ChangePasswordSection />);
    await fill('Mala1234', 'NuevaClave1');
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
    const first = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar la contraseña' });
    expect(within(first).getByText('Contraseña común')).toBeInTheDocument(); // detalle por campo
    expect(screen.getByLabelText('Nueva contraseña')).toHaveAccessibleDescription('Contraseña común');
    await userEvent.click(within(first).getByRole('button', { name: 'Entendido' }));

    mockFetch(apiFail(503, 'SERVER_BUSY', 'Ocupado'));
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    const second = await screen.findByRole('alertdialog', { name: 'No se pudo cambiar la contraseña' });
    expect(second).toHaveTextContent('Ocupado');
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
