import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { setLocale } from '../../i18n/core';
import { pick, renderPage } from '../../test/companyPages';
import { samplePolicy, sampleValidator } from '../../test/fixtures';
import { apiOk, mockFetch, type MockCall } from '../../test/http';
import type { Validator } from '../../types';
import { ValidatorFormPage } from './ValidatorFormPage';
import { ValidatorsPage } from './ValidatorsPage';

const deleted: Validator = { ...sampleValidator, deleted_at: '2026-10-05T16:00:00Z', deleted_by: 'ana@empresa.com' };
const RESTORED = 'Validador restaurado.';

/** La empresa: sus validadores (vigentes o en «Eliminados»), su política y la restauración. */
function server(current: () => Validator = () => deleted, trash: Validator[] = [deleted]) {
  return mockFetch((call: MockCall) => {
    if (call.url === '/api/settings/verification') return apiOk(samplePolicy);
    if (call.url.endsWith('/restore')) return apiOk(sampleValidator, { code: 'VALIDATOR_RESTORED', message: RESTORED });
    if (call.url.startsWith('/api/validators?')) {
      const items = call.url.includes('deleted=true') ? trash : [sampleValidator];
      return apiOk({ items, total: items.length, page: 1, size: 10, active: 1, limit: 3 });
    }
    return apiOk(current());
  });
}

afterEach(() => resetPolicyCache());

describe('Validadores: «Eliminados»', () => {
  it('solo el filtro (sin búsqueda); la tarjeta eliminada dice cuándo y quién y se restaura', async () => {
    const { calls } = server();
    renderPage('/company/validators', '/company/validators', <ValidatorsPage />);
    await screen.findByText('Recepción planta 1');
    expect(screen.queryByRole('searchbox')).toBeNull();
    await pick(/Filtrar por estado/, /^Eliminados$/);
    await waitFor(() => expect(calls.at(-1)?.url).toBe('/api/validators?page=1&size=10&deleted=true'));
    expect(await screen.findByText(/Se eliminó el .* por ana@empresa\.com/)).toBeInTheDocument();
    expect(screen.getByText('1 eliminado')).toBeInTheDocument();
    // Sin editar, contraseña, dispositivos, estado ni eliminar.
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Recepción planta 1' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar el validador Recepción planta 1?' });
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Correo de accesorecepcion@empresa.comModoQR o rostro');
    expect(dialog.querySelector('.confirm-note')).toHaveTextContent('Sus fotos no se recuperan.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: RESTORED })).toBeInTheDocument();
  });

  it('sin eliminados: «Nada eliminado»', async () => {
    server(undefined, []);
    renderPage('/company/validators', '/company/validators', <ValidatorsPage />);
    await screen.findByText('Recepción planta 1');
    await pick(/Filtrar por estado/, /^Eliminados$/);
    expect(await screen.findByText('Nada eliminado')).toBeInTheDocument();
  });

  it('la edición de uno eliminado es su aviso con «Restaurar»; al restaurarlo vuelve su formulario', async () => {
    let current = deleted;
    const { calls } = server(() => current);
    renderPage('/company/validators/:id/edit', '/company/validators/3/edit', <ValidatorFormPage />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('Validador eliminado');
    expect(screen.getByText('recepcion@empresa.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull();
    expect(calls.map((call) => call.url)).toEqual(['/api/validators/3']);

    current = sampleValidator;
    await userEvent.click(within(banner).getByRole('button', { name: 'Restaurar Recepción planta 1' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar el validador Recepción planta 1?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('en inglés: el aviso del validador eliminado', async () => {
    await setLocale('en-US');
    server();
    renderPage('/company/validators/:id/edit', '/company/validators/3/edit', <ValidatorFormPage />);
    expect(await screen.findByRole('status')).toHaveTextContent(/Validator deletedDeleted .* by ana@empresa\.com/);
    expect(screen.getByRole('button', { name: 'Restore Recepción planta 1' })).toBeInTheDocument();
  });
});
