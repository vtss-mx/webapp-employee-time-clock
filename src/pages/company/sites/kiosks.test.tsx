import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../../../i18n/core';
import { plant } from '../../../test/sites';
import { apiFail, apiOk, jsonResponse, envelope, mockFetch, type MockCall } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import type { Kiosk, KioskCreated, WorkSite } from '../../../types';
import { KioskFormPage } from './KioskFormPage';
import { SiteFormPage } from './SiteFormPage';
import { SiteKiosksPage } from './SiteKiosksPage';
import { SitesPage } from './SitesPage';

const site: WorkSite = { ...plant, presence_code: true, kiosks: 2 };
const kiosk = (extra: Partial<Kiosk> = {}): Kiosk => ({
  id: 9,
  site_id: 3,
  name: 'Entrada principal',
  paired: true,
  paired_at: '2026-10-01T10:00:00Z',
  device_name: 'Safari · iPadOS',
  last_seen_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  pairing_expires_at: null,
  created_at: '2026-10-01T00:00:00Z',
  deleted_at: null,
  deleted_by: null,
  ...extra,
});
const spare = kiosk({ id: 10, name: 'Comedor', paired: false, paired_at: null, device_name: null, last_seen_at: null });
const created = (item: Kiosk): KioskCreated => ({ kiosk: item, pairing_code: 'ABCDE-23456', pairing_expires_at: '2026-10-06T10:00:00Z' });
const page = (items: Kiosk[]) => ({ items, total: items.length, page: 1, size: 10 });
const writes = (calls: MockCall[]) => calls.filter((c) => c.init.method !== 'GET');

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/sites" element={<SitesPage />} />
      <Route path="/company/sites/:id/edit" element={<SiteFormPage />} />
      <Route path="/company/sites/:id/kiosks" element={<SiteKiosksPage />} />
      <Route path="/company/sites/:id/kiosks/new" element={<KioskFormPage />} />
    </Routes>,
    { route },
  );
}

/** El servidor de los kioscos de un sitio: lo que no es una lectura lo responde `write`. */
function serve({ items = [kiosk(), spare], trash = [] as Kiosk[], write = (_call: MockCall): Response => apiOk(null), current = site } = {}) {
  return mockFetch((call) => {
    if (call.init.method && call.init.method !== 'GET') return write(call);
    if (call.url.includes('/kiosks')) return apiOk(page(call.url.includes('deleted=true') ? trash : items));
    if (call.url.startsWith('/api/sites/3')) return apiOk(current);
    return apiOk({ items: [current], total: 1, page: 1, size: 10 });
  });
}

describe('Sitios: código de sitio y kioscos (antifraude 2b)', () => {
  it('el listado dice si cada sitio pide código y lleva a sus kioscos sin abrir la edición', async () => {
    serve();
    renderAt('/company/sites');
    const row = (await screen.findByText('Planta Norte')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Pide código')).toBeInTheDocument();
    const link = within(row).getByRole('link', { name: '2 kioscos de Planta Norte' });
    expect(link).toHaveAttribute('href', '/company/sites/3/kiosks');
    fireEvent.keyDown(link, { key: 'Enter' }); // el Enter del enlace no abre la edición de la fila
    await userEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Kioscos' })).toBeInTheDocument();
  });

  it('un sitio sin código lo dice; en sus kioscos se explica cómo activarlo', async () => {
    serve({ current: { ...site, presence_code: false, kiosks: 1 }, items: [] });
    renderAt('/company/sites');
    const row = (await screen.findByText('Planta Norte')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Sin código')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('link', { name: '1 kiosco de Planta Norte' }));
    expect(await screen.findByText('Este sitio no pide su código: actívalo en la edición del sitio.')).toBeInTheDocument();
    expect(screen.getByText('Sin kioscos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Nuevo kiosco' })[1]).toHaveAttribute('href', '/company/sites/3/kiosks/new');
  });

  it('editar el sitio: el código se activa con su interruptor y la confirmación lo muestra "antes → después"', async () => {
    const { calls } = serve({ current: plant, write: () => apiOk({ ...plant, presence_code: true }) });
    renderAt('/company/sites/3/edit');
    const toggle = await screen.findByRole('switch', { name: 'Código de sitio' });
    expect(screen.getByText('Pide al verificar el código que muestra el kiosco del sitio.')).toBeInTheDocument();
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Guardar los cambios del sitio Planta Norte?' });
    expect(within(confirm).getByRole('region', { name: 'Cambios' })).toHaveTextContent('Código de sitioAntes: Sin códigoDespués: Pide código');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(JSON.parse(writes(calls)[0].init.body as string)).toMatchObject({ presence_code: true });
  });

  it('kioscos: cada uno con su tableta (vinculado o no) y su última conexión', async () => {
    serve();
    renderAt('/company/sites/3/kiosks');
    expect(await screen.findByText('Planta Norte · 2 kioscos')).toBeInTheDocument();
    expect(screen.getByText('La tableta de cada kiosco muestra el código que tu personal escanea o escribe al verificar su identidad en el sitio.')).toBeInTheDocument();
    const paired = (await screen.findByText('Entrada principal')).closest('tr') as HTMLElement;
    expect(within(paired).getByText('Safari · iPadOS')).toBeInTheDocument();
    expect(within(paired).getByText('Vinculado')).toBeInTheDocument();
    expect(within(paired).getByText('hace 5 minutos')).toBeInTheDocument();
    const loose = screen.getByText('Comedor').closest('tr') as HTMLElement;
    expect(within(loose).getByText('Sin vincular')).toBeInTheDocument();
    expect(within(loose).getByText('Nunca')).toBeInTheDocument();
  });

  it('nuevo código de vinculación: se confirma (la tableta deja de funcionar) y se muestra UNA vez con su QR', async () => {
    const { calls } = serve({ write: () => apiOk(created(kiosk())) });
    renderAt('/company/sites/3/kiosks');
    const row = (await screen.findByText('Entrada principal')).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Nuevo código de vinculación' }));
    const confirm = await screen.findByRole('alertdialog', { name: '¿Generar un código de vinculación para Entrada principal?' });
    expect(confirm).toHaveTextContent('La tableta vinculada dejará de mostrar el código hasta que la vincules de nuevo.');
    expect(confirm).toHaveTextContent('TabletaSafari · iPadOS');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    expect(writes(calls)).toHaveLength(0);

    await userEvent.click(within(row).getByRole('button', { name: 'Nuevo código de vinculación' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Nuevo código de vinculación' }));
    const popup = await screen.findByRole('dialog', { name: 'Vincula la tableta de Entrada principal' });
    expect(popup).toHaveTextContent('Código de vinculación nuevo');
    expect(within(popup).getByText('ABCDE-23456')).toBeInTheDocument();
    expect(within(popup).getByText(`${window.location.origin}/kiosk#pair=ABCDE-23456`)).toBeInTheDocument();
    expect(popup).toHaveTextContent('Solo se muestra esta vez.');
    expect(await within(popup).findByRole('img', { name: 'QR para vincular la tableta' })).toBeInTheDocument();
    expect(within(popup).queryByRole('button', { name: /Cerrar/ })).toBeNull(); // solo se cierra confirmando
    await userEvent.click(within(popup).getByRole('button', { name: 'Ya lo guardé' }));
    expect(writes(calls).map((c) => [c.init.method, c.url])).toEqual([['POST', '/api/sites/3/kiosks/9/pairing']]);
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/sites/3/kiosks?'))).toHaveLength(2));

    // Sin tableta vinculada no hay nada que deje de funcionar.
    await userEvent.click(within(screen.getByText('Comedor').closest('tr') as HTMLElement).getByRole('button', { name: 'Nuevo código de vinculación' }));
    const loose = await screen.findByRole('alertdialog', { name: '¿Generar un código de vinculación para Comedor?' });
    expect(loose).toHaveTextContent('TabletaSin vincular');
    expect(loose).not.toHaveTextContent('dejará de mostrar');
  });

  it('eliminar se confirma (pasa a «Eliminados»); un error se explica; en «Eliminados» se restaura', async () => {
    let deletes = 0;
    const { calls } = serve({
      trash: [kiosk({ deleted_at: '2026-10-04T10:00:00Z', deleted_by: 'ana@empresa.com' })],
      write: (call) => {
        if (call.url.endsWith('/restore')) return apiOk(kiosk(), { message: 'Kiosco restaurado. Vincula su tableta de nuevo.' });
        return ++deletes === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Falla') : apiOk(null);
      },
    });
    renderAt('/company/sites/3/kiosks');
    const remove = async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Eliminar el kiosco Entrada principal' }));
      const confirm = await screen.findByRole('alertdialog', { name: '¿Eliminar el kiosco Entrada principal?' });
      expect(confirm).toHaveTextContent('Pasará a «Eliminados»');
      await userEvent.click(within(confirm).getByRole('button', { name: 'Eliminar' }));
    };
    await remove();
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo eliminar el kiosco' })).getByRole('button', { name: 'Entendido' }));
    await remove();
    expect(await screen.findByRole('dialog', { name: 'Kiosco eliminado' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));

    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    await userEvent.click(screen.getByRole('option', { name: 'Eliminados' }));
    const row = (await screen.findByText(/ana@empresa.com/)).closest('tr') as HTMLElement;
    await userEvent.click(within(row).getByRole('button', { name: 'Restaurar Entrada principal' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Restaurar el kiosco Entrada principal?' });
    expect(confirm).toHaveTextContent('SitioPlanta Norte');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Kiosco restaurado. Vincula su tableta de nuevo.' })).toBeInTheDocument();
    expect(writes(calls).map((c) => [c.init.method, c.url])).toEqual([
      ['DELETE', '/api/sites/3/kiosks/9'],
      ['DELETE', '/api/sites/3/kiosks/9'],
      ['POST', '/api/sites/3/kiosks/9/restore'],
    ]);
  });

  it('si los kioscos no cargan lo dice', async () => {
    mockFetch((call) => {
      if (call.url.includes('/kiosks?')) return apiFail(500, 'INTERNAL_ERROR', 'Falla');
      return apiOk(site);
    });
    renderAt('/company/sites/3/kiosks');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar los kioscos' })).toBeInTheDocument();
  });

  it('un código que no se pudo generar se explica', async () => {
    serve({ write: () => apiFail(404, 'KIOSK_NOT_FOUND', 'El kiosco ya no existe') });
    renderAt('/company/sites/3/kiosks');
    await userEvent.click((await screen.findAllByRole('button', { name: 'Nuevo código de vinculación' }))[0]);
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Nuevo código de vinculación' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo generar el código de vinculación' })).toHaveTextContent('El kiosco ya no existe');
  });

  it('nuevo kiosco: nombre obligatorio, se confirma, el servidor marca el nombre y al crearlo muestra el código', async () => {
    let posts = 0;
    const { calls } = serve({
      write: () => {
        posts += 1;
        if (posts === 1) return jsonResponse(envelope(null, { status: 409, code: 'KIOSK_NAME_TAKEN', message: 'Ya existe', errors: [{ code: 'KIOSK_NAME_TAKEN', message: 'Ya hay un kiosco con ese nombre', field: 'name' }] }), 409);
        return apiOk(created(kiosk({ id: 11, name: 'Recepción', paired: false })), { status: 201 });
      },
    });
    renderAt('/company/sites/3/kiosks/new');
    expect(await screen.findByText('Planta Norte')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear kiosco' }));
    expect(screen.getByText('Escribe el nombre del kiosco')).toBeInTheDocument();
    expect(writes(calls)).toHaveLength(0);

    const name = screen.getByLabelText(/Nombre/);
    await userEvent.type(name, '  Recepción ');
    await userEvent.click(screen.getByRole('button', { name: 'Crear kiosco' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Crear el kiosco Recepción?' });
    expect(confirm).toHaveTextContent('SitioPlanta Norte');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Crear kiosco' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo crear el kiosco' })).getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Ya hay un kiosco con ese nombre')).toBeInTheDocument();
    await userEvent.type(name, 'x');
    expect(screen.queryByText('Ya hay un kiosco con ese nombre')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Crear kiosco' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Crear el kiosco Recepción x?' })).getByRole('button', { name: 'Crear kiosco' }));
    const popup = await screen.findByRole('dialog', { name: 'Vincula la tableta de Recepción' });
    expect(popup).toHaveTextContent('Kiosco creado');
    expect(await screen.findByRole('heading', { name: 'Kioscos' })).toBeInTheDocument();
    expect(writes(calls).map((c) => JSON.parse(c.init.body as string) as unknown)).toEqual([{ name: 'Recepción' }, { name: 'Recepción x' }]);
  });

  it('si el sitio no carga lo dice (los kioscos y el alta siguen funcionando)', async () => {
    const { calls } = mockFetch((call) => {
      if (call.init.method === 'POST') return apiOk(created(kiosk({ id: 12, name: 'Patio' })), { status: 201 });
      if (call.url.includes('/kiosks')) return apiOk(page([]));
      return apiFail(500, 'INTERNAL_ERROR', 'Falla');
    });
    renderAt('/company/sites/3/kiosks/new');
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el sitio' })).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Patio');
    await userEvent.click(screen.getByRole('button', { name: 'Crear kiosco' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Crear el kiosco Patio?' })).getByRole('button', { name: 'Crear kiosco' }));
    expect(await screen.findByRole('dialog', { name: 'Vincula la tableta de Patio' })).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method === 'POST')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Ya lo guardé' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo cargar el sitio' })).toBeInTheDocument(); // la lista vuelve a pedir el sitio
  });

  it('nuevo kiosco: cancelar regresa a los kioscos', async () => {
    serve();
    renderAt('/company/sites/3/kiosks/new');
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByRole('heading', { name: 'Kioscos' })).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    serve();
    renderAt('/company/sites/3/kiosks');
    expect(await screen.findByText('Planta Norte · 2 kiosks')).toBeInTheDocument();
    const row = (await screen.findByText('Entrada principal')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Paired')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Kiosk', 'Tablet', 'Last seen', 'Actions']);
  });
});
