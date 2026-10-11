import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { PlatformKey, SigningKey, SigningKeyLimits } from '../../types';
import { SigningKeyFormPage } from './SigningKeyFormPage';
import { SigningKeysPage } from './SigningKeysPage';

/**
 * Claves de FIRMA de la empresa (sección de «Integraciones (API)», migración 0105 del backend): el listado con la
 * clave pública de la plataforma, registrar la propia, generar el par (la privada una sola vez y nunca guardada),
 * rotar con días de gracia y revocar al instante.
 *
 * Se recorre CADA respuesta de las cuatro rutas (regla 7 de la raíz): el éxito, los vacíos, el 404, el 409 de cada
 * código, el 422 por campo y las fallas del servidor, y se verifica que ningún número del servidor esté escrito en
 * la app (regla 25): el tope, la vigencia por omisión, su tope y los días de gracia salen de `limits`.
 */

const FINGERPRINT = '3b1f7d90a4c25e68b0d14f73a9c82e5106bd4f37c91a8e02d5b6473fa1c80e92';
const PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE9pL0c4fQ2b1mN7v5R8sT3uW6xY0zA1B2C3D4E5F6g7H8i9J0kL1mN2oP3qR4sT5uV6wX7==';
const PLATFORM_FINGERPRINT = 'c70e4a1826fb5d03941e7c6ab2850f39d1476be02a85c3f914d60b7e285a3f41';
const PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg\n-----END PRIVATE KEY-----\n';

const key = (over: Partial<SigningKey> = {}): SigningKey => ({
  id: 1,
  label: 'Nómina',
  fingerprint: FINGERPRINT,
  public_key: PUBLIC_KEY,
  algorithm: 'ES256',
  generated: false,
  status: 'ACTIVE',
  created_at: '2026-10-01T12:00:00Z',
  created_by: 'admin@empresa.com',
  expires_at: '2027-10-01T12:00:00Z',
  days_to_expire: 365,
  expiring_soon: false,
  revoked_at: null,
  revoked_by: null,
  last_used_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  ...over,
});

const PLATFORM: PlatformKey = { configured: true, fingerprint: PLATFORM_FINGERPRINT, public_key: PUBLIC_KEY, algorithm: 'ES256' };
const LIMITS: SigningKeyLimits = { active: 1, max_active: 5, default_days: 365, max_days: 730, grace_days: 7 };

const page = (items: SigningKey[], over: { platform?: PlatformKey; limits?: Partial<SigningKeyLimits> } = {}) => ({
  items,
  total: items.length,
  page: 1,
  size: 10,
  platform: over.platform ?? PLATFORM,
  limits: { ...LIMITS, ...over.limits },
});

/** El cuerpo JSON de la petición que escribió (la API lo manda como texto). */
const bodyOf = (calls: Array<{ init: RequestInit }>): Record<string, unknown> =>
  JSON.parse((calls.find((call) => call.init.method === 'POST')?.init.body ?? '{}') as string) as Record<string, unknown>;

function renderList() {
  return renderWithProviders(
    <Routes>
      <Route path="/company/integrations/signing-keys" element={<SigningKeysPage />} />
      <Route path="/company/integrations/signing-keys/new" element={<p>Agregar</p>} />
      <Route path="/company/integrations" element={<p>Integraciones</p>} />
    </Routes>,
    { route: '/company/integrations/signing-keys' },
  );
}

function renderForm(search = '') {
  return renderWithProviders(
    <Routes>
      <Route path="/company/integrations/signing-keys/new" element={<SigningKeyFormPage />} />
      <Route path="/company/integrations/signing-keys" element={<p>Claves</p>} />
    </Routes>,
    { route: `/company/integrations/signing-keys/new${search}` },
  );
}

describe('Claves de firma: listado', () => {
  it('muestra cada clave con su huella, origen, vigencia, uso y la clave de la plataforma', async () => {
    mockFetch(
      apiOk(
        page([
          key(),
          key({ id: 2, label: 'ERP', generated: true, created_by: null, last_used_at: null, status: 'REVOKED', revoked_at: '2026-10-02T12:00:00Z', revoked_by: 'rh@empresa.com' }),
        ]),
      ),
    );
    renderList();
    const nomina = (await screen.findByText('Nómina')).closest('li')!;
    expect(within(nomina).getByText(FINGERPRINT)).toBeInTheDocument();
    expect(within(nomina).getByRole('button', { name: 'Copiar huella' })).toBeInTheDocument();
    expect(within(nomina).getByText(/Clave pública que registraste/)).toBeInTheDocument();
    expect(within(nomina).getByText(/por admin@empresa.com/)).toBeInTheDocument();
    expect(within(nomina).getByText(/Último uso hace 5 minutos/)).toBeInTheDocument();
    expect(within(nomina).getByText('Activa')).toBeInTheDocument();
    expect(within(nomina).getByText('ES256')).toBeInTheDocument();

    const erp = screen.getByText('ERP').closest('li')!;
    expect(within(erp).getByText(/Par generado por la plataforma/)).toBeInTheDocument();
    expect(within(erp).getByText(/Aún sin usar/)).toBeInTheDocument();
    expect(within(erp).getByText(/por rh@empresa.com/)).toBeInTheDocument();
    expect(within(erp).queryByRole('link', { name: 'Rotar' })).toBeNull(); // una revocada no se rota ni se revoca
    expect(within(erp).queryByRole('button', { name: 'Revocar' })).toBeNull();

    // Las cifras del tope son del SERVIDOR (regla 25): la app solo las dibuja.
    expect(screen.getByText(/Vigentes: 1 de 5/)).toBeInTheDocument();
    expect(screen.getByText(PLATFORM_FINGERPRINT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar clave pública de la plataforma' })).toBeInTheDocument();
  });

  it('una clave sin quién la registró ni quién la revocó se dibuja igual, y la que vence pronto lo avisa', async () => {
    mockFetch(apiOk(page([key({ created_by: null, expiring_soon: true, days_to_expire: 6 }), key({ id: 2, label: 'ERP', status: 'REVOKED', revoked_at: '2026-10-02T12:00:00Z', revoked_by: null })])));
    renderList();
    expect(await screen.findByText('Vence en 6 días')).toBeInTheDocument();
    expect(screen.getByText(/^Revocada /)).toBeInTheDocument(); // sin «por …»: el servidor no mandó quién
  });

  it('al tope de claves vigentes no ofrece registrar ni rotar: la salida es revocar una', async () => {
    mockFetch(apiOk(page([key()], { limits: { active: 5 } })));
    renderList();
    expect(await screen.findByText(/Llegaste al tope/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agregar clave' })).toBeNull();
    const rotate = screen.getByRole('button', { name: 'Rotar' });
    expect(rotate).toBeDisabled();
    expect(rotate).toHaveAttribute('title', 'Revoca una clave vigente para registrar otra');
    expect(screen.getByRole('button', { name: 'Revocar' })).toBeEnabled();
  });

  it('sin la clave de la plataforma lo dice con naturalidad, no como un error', async () => {
    mockFetch(apiOk(page([key()], { platform: { configured: false, fingerprint: null, public_key: null, algorithm: null } })));
    renderList();
    expect(await screen.findByText('Sin firma en las respuestas')).toBeInTheDocument();
    expect(screen.getByText('La plataforma no firma lo que responde: no hay nada que comprobar.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('una plataforma que dice estar configurada pero no manda la clave se trata igual que sin firma', async () => {
    mockFetch(apiOk(page([key()], { platform: { configured: true, fingerprint: null, public_key: null, algorithm: null } })));
    renderList();
    expect(await screen.findByText('Sin firma en las respuestas')).toBeInTheDocument();
  });

  it('sin claves: estado vacío que lleva a registrar la primera', async () => {
    mockFetch(apiOk(page([])));
    renderList();
    expect(await screen.findByText('Sin claves de firma')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginación' })).toBeNull();
    await userEvent.click(screen.getAllByRole('link', { name: 'Agregar clave' })[0]);
    expect(screen.getByText('Agregar')).toBeInTheDocument();
  });

  it('si no carga ofrece reintentar y no inventa las cifras del tope', async () => {
    mockFetch(apiFail(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible'));
    renderList();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las claves de firma' })).toBeInTheDocument();
    expect(screen.queryByText(/Vigentes:/)).toBeNull();
  });

  it('revocar pregunta qué deja de funcionar, avisa que es inmediato y vuelve a pedir la lista', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'DELETE' ? apiOk(key({ status: 'REVOKED' })) : apiOk(page([key()]))));
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Revocar «Nómina»?' });
    expect(dialog).toHaveTextContent('dejarán de pasar de inmediato');
    expect(dialog).toHaveTextContent('Es inmediato, a diferencia de rotar.');
    expect(within(dialog).getByRole('region', { name: 'Dejará de servir' })).toHaveTextContent(`Huella${FINGERPRINT}Último usohace 5 minutos`);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revocar clave' }));
    expect(await screen.findByText('Clave revocada')).toBeInTheDocument();
    expect(calls.find((c) => c.init.method === 'DELETE')?.url).toBe('/api/api-keys/signing-keys/1');
    expect(calls.filter((c) => c.init.method !== 'DELETE')).toHaveLength(2); // se volvió a pedir la lista
  });

  it('cancelar revocar no envía nada; una clave aún sin usar lo dice en la confirmación', async () => {
    const { calls } = mockFetch(apiOk(page([key({ last_used_at: null })])));
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Revocar «Nómina»?' });
    expect(within(dialog).getByRole('region', { name: 'Dejará de servir' })).toHaveTextContent('Último usoAún sin usar');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(calls).toHaveLength(1);
  });

  it('si revocar falla lo explica y no toca la lista', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'DELETE' ? apiFail(500, 'INTERNAL_ERROR', 'Error inesperado') : apiOk(page([key()]))));
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Revocar «Nómina»?' })).getByRole('button', { name: 'Revocar clave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo revocar la clave' })).toBeInTheDocument();
    expect(calls.filter((c) => c.init.method !== 'DELETE')).toHaveLength(1);
  });

  it('una clave que ya no existe (404) se explica y la lista se vuelve a pedir', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'DELETE' ? apiFail(404, 'SIGNING_KEY_NOT_FOUND', 'Clave de firma no encontrada') : apiOk(page([key()]))));
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Revocar «Nómina»?' })).getByRole('button', { name: 'Revocar clave' }));
    expect(await screen.findByText('Clave de firma no encontrada')).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => c.init.method !== 'DELETE')).toHaveLength(2));
  });

  it('tras revocar vuelve a pedir la lista y, mientras llega, la atenúa', async () => {
    let release: (response: Response) => void = () => undefined;
    let lists = 0;
    mockFetch((call) => {
      if (call.init.method === 'DELETE') return apiOk(key({ status: 'REVOKED' }));
      lists += 1;
      return lists === 1 ? apiOk(page([key()])) : new Promise<Response>((done) => (release = done));
    });
    renderList();
    await userEvent.click(await screen.findByRole('button', { name: 'Revocar' }));
    await userEvent.click(within(await screen.findByRole('alertdialog', { name: '¿Revocar «Nómina»?' })).getByRole('button', { name: 'Revocar clave' }));
    expect(await screen.findByText('Clave revocada')).toBeInTheDocument();
    expect(screen.getByText('Nómina').closest('ul')).toHaveClass('is-loading');
    release(apiOk(page([key({ status: 'REVOKED', revoked_at: '2026-10-02T12:00:00Z' })], { limits: { active: 0 } })));
    await waitFor(() => expect(screen.getByText('Nómina').closest('ul')).not.toHaveClass('is-loading'));
    expect(screen.queryByRole('button', { name: 'Revocar' })).toBeNull();
  });

  it('«Rotar» lleva al formulario con la clave que se reemplaza', async () => {
    mockFetch(apiOk(page([key()])));
    renderList();
    const rotate = await screen.findByRole('link', { name: 'Rotar' });
    expect(rotate).toHaveAttribute('href', '/company/integrations/signing-keys/new?replaces=1');
    await userEvent.click(rotate);
    expect(screen.getByText('Agregar')).toBeInTheDocument();
  });

  it('en inglés el listado se lee en inglés', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(page([key()])));
    renderList();
    expect(await screen.findByText('Signing keys')).toBeInTheDocument();
    expect(screen.getByText(/Active: 1 of 5/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add key' })).toBeInTheDocument();
  });
});

describe('Claves de firma: agregar y rotar', () => {
  /** Lo que la pantalla pide al cargar (el listado, por sus `limits` y las claves que se pueden reemplazar). */
  const listOnly = (items: SigningKey[] = [key()]) => apiOk(page(items));

  it('registra la clave pública con el nombre limpio, la vigencia del servidor y avisa al terminar', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk(key({ label: 'Nómina' }), { status: 201 }) : listOnly([])));
    renderForm();
    expect(await screen.findByLabelText(/Nombre/)).toBeInTheDocument();
    // La vigencia por omisión y su tope son del SERVIDOR (regla 25).
    expect(screen.getByLabelText('Vence en')).toHaveValue('365');
    expect(screen.getByText('A lo más 730 días.')).toBeInTheDocument();
    expect(screen.getByText('Recomendado: generas el par donde quieras y tu clave privada nunca llega al servidor.')).toBeInTheDocument();
    // Sin claves vigentes no hay nada que reemplazar: la sección no aparece.
    expect(screen.queryByLabelText('Reemplaza a')).toBeNull();

    await userEvent.type(screen.getByLabelText(/Nombre/), '  Nómina  ');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' });
    expect(within(confirm).getByRole('region', { name: 'Se registrará' })).toHaveTextContent('NombreNóminaDe dónde sale el parRegistro mi clave públicaVigencia365 días');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Registrar clave' }));

    expect(await screen.findByText('Clave de firma registrada')).toBeInTheDocument();
    expect(screen.getByText('Tu sistema ya puede firmar sus peticiones con «Nómina».')).toBeInTheDocument();
    expect(calls.find((call) => call.init.method === 'POST')?.url).toBe('/api/api-keys/signing-keys');
    expect(bodyOf(calls)).toEqual({ label: 'Nómina', public_key: PUBLIC_KEY, expires_in_days: 365, replaces: null });
  });

  it('exige el nombre y la clave pública antes de enviar nada', async () => {
    const { calls } = mockFetch(listOnly([]));
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar clave' }));
    expect(screen.getByText('Escribe para qué sistema es la clave')).toBeInTheDocument();
    expect(screen.getByText('Pega tu clave pública o elige su archivo')).toBeInTheDocument();
    expect(calls).toHaveLength(1); // solo la carga
    expect(screen.getByRole('button', { name: 'Registrar clave' })).toBeDisabled();
    // Al escribir, el aviso del campo desaparece.
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Nómina');
    expect(screen.queryByText('Escribe para qué sistema es la clave')).toBeNull();
  });

  it('generar el par muestra la clave privada UNA sola vez y no la guarda en el navegador', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk({ ...key({ generated: true }), private_key: PRIVATE_KEY }, { status: 201 }) : listOnly([])));
    renderForm();
    await userEvent.click(await screen.findByRole('radio', { name: 'Que la plataforma genere el par' }));
    expect(screen.queryByLabelText(/Clave pública/)).toBeNull(); // no se pide nada que no haga falta
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Nómina');
    await userEvent.click(screen.getByRole('button', { name: 'Generar el par' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Generar el par de «Nómina»?' });
    expect(confirm).toHaveTextContent('La clave privada no se podrá volver a consultar.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Generar el par' }));

    const shown = await screen.findByRole('dialog', { name: 'Copia la clave privada de «Nómina»' });
    expect(within(shown).getByText(/BEGIN PRIVATE KEY/)).toBeInTheDocument();
    expect(within(shown).queryByLabelText('Cerrar')).toBeNull(); // solo se cierra confirmando que ya se guardó
    await userEvent.click(within(shown).getByRole('button', { name: 'Copiar clave privada' }));
    expect(writeText).toHaveBeenCalledWith(PRIVATE_KEY);
    await userEvent.click(within(shown).getByRole('button', { name: 'Ya la guardé' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Nada del secreto queda en el navegador ni en la pantalla.
    expect(screen.queryByText(/BEGIN PRIVATE KEY/)).toBeNull();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(bodyOf(calls)).toEqual({ label: 'Nómina', expires_in_days: 365, replaces: null });
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('el archivo de la clave se lee en el navegador, se puede quitar y una falla al leerlo se marca en el campo', async () => {
    mockFetch(listOnly([]));
    renderForm();
    const picker = await screen.findByLabelText(/Archivo de la clave/);
    await userEvent.upload(picker, new File([`  ${PUBLIC_KEY}  `], 'clave.pem', { type: 'text/plain' }));
    await waitFor(() => expect(screen.getByLabelText(/Clave pública/)).toHaveValue(PUBLIC_KEY));
    await userEvent.click(screen.getByRole('button', { name: 'Quitar archivo' }));
    await waitFor(() => expect(screen.getByLabelText(/Clave pública/)).toHaveValue(''));

    const broken = new File(['x'], 'roto.pem', { type: 'text/plain' });
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('NO_READ'));
    await userEvent.upload(picker, broken);
    expect(await screen.findByText('No se pudo leer el archivo')).toBeInTheDocument();
  });

  it('rotar llega con la clave que reemplaza, lo dice en el título y lo advierte con los días del servidor', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk(key({ id: 9 }), { status: 201 }) : listOnly([key(), key({ id: 2, label: 'ERP', status: 'REVOKED' })])));
    renderForm('?replaces=1');
    expect(await screen.findByText('Rotar clave de firma')).toBeInTheDocument();
    expect(screen.getByLabelText('Reemplaza a')).toHaveTextContent('Nómina');
    expect(screen.getByText('La clave que reemplaces seguirá firmando 7 días más.')).toBeInTheDocument();
    // Una clave revocada no se puede reemplazar: no está entre las opciones.
    await userEvent.click(screen.getByLabelText('Reemplaza a'));
    expect(screen.queryByRole('option', { name: /ERP/ })).toBeNull();
    await userEvent.keyboard('{Escape}');

    await userEvent.type(screen.getByLabelText(/Nombre/), 'Nómina 2026');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    const confirm = await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina 2026»?' });
    expect(within(confirm).getByRole('region', { name: 'Se registrará' })).toHaveTextContent('Reemplaza aNómina');
    expect(confirm).toHaveTextContent('La clave que reemplazas seguirá firmando 7 días y después dejará de servir.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Registrar clave' }));
    await waitFor(() => expect(bodyOf(calls).replaces).toBe(1));
  });

  it('se puede elegir a mano la clave que se reemplaza y el título lo refleja', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk(key({ id: 9 }), { status: 201 }) : listOnly([key()])));
    renderForm();
    expect(await screen.findByText('Agregar clave de firma')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Reemplaza a'));
    await userEvent.click(await screen.findByRole('option', { name: /Nómina/ }));
    expect(await screen.findByText('Rotar clave de firma')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Nombre/), 'Nómina 2026');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina 2026»?' })).getByRole('button', { name: 'Registrar clave' }));
    await waitFor(() => expect(bodyOf(calls).replaces).toBe(1));
  });

  it('un «reemplaza» que no existe se ignora: nunca se confía en la dirección', async () => {
    mockFetch(listOnly([key()]));
    renderForm('?replaces=999');
    expect(await screen.findByText('Agregar clave de firma')).toBeInTheDocument();
    expect(screen.getByLabelText('Reemplaza a')).toHaveTextContent('Ninguna: es una clave más');
  });

  it('cancelar la confirmación deja el formulario como estaba', async () => {
    const { calls } = mockFetch(listOnly([]));
    renderForm();
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' })).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls).toHaveLength(1);
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Nómina');
  });

  it('la vigencia que se escribe viaja tal cual y, vacía, la pone el servidor', async () => {
    const { calls } = mockFetch((call) => (call.init.method === 'POST' ? apiOk(key(), { status: 201 }) : listOnly([])));
    renderForm();
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.clear(screen.getByLabelText('Vence en'));
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    // Vacía, la confirmación muestra la vigencia por omisión que envió el servidor.
    const confirm = await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' });
    expect(within(confirm).getByRole('region', { name: 'Se registrará' })).toHaveTextContent('Vigencia365 días');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Registrar clave' }));
    await waitFor(() => expect(bodyOf(calls).expires_in_days).toBeNull());
  });

  it('un 422 de la clave pública se marca en su campo', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(422, 'SIGNING_KEY_INVALID', 'La clave pública debe ser otra') : listOnly([])));
    renderForm();
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), 'no-es-una-clave');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' })).getByRole('button', { name: 'Registrar clave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la clave' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByLabelText(/Clave pública/)).toHaveAccessibleDescription(/La clave pública debe ser otra/);
  });

  it('el tope de claves vigentes se explica por su nombre y no ofrece reintentar', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'SIGNING_KEY_LIMIT', 'Tu empresa ya tiene 5 claves de firma vigentes.') : listOnly([])));
    renderForm();
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' })).getByRole('button', { name: 'Registrar clave' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Llegaste al tope de claves vigentes' });
    expect(popup).toHaveTextContent('Tu empresa ya tiene 5 claves de firma vigentes.');
    expect(within(popup).queryByRole('button', { name: 'Reintentar' })).toBeNull(); // un 409 no se reintenta
  });

  it('una clave pública ya registrada se explica y se marca en su campo', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(409, 'SIGNING_KEY_DUPLICATE', 'Esta clave pública ya está registrada en tu empresa') : listOnly([])));
    renderForm();
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' })).getByRole('button', { name: 'Registrar clave' }));
    expect(await screen.findByRole('alertdialog', { name: 'Esa clave pública ya está registrada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByLabelText(/Clave pública/)).toHaveAccessibleDescription(/ya está registrada/);
  });

  it('la clave que se iba a reemplazar ya no está (404): se marca en su campo', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(404, 'SIGNING_KEY_NOT_FOUND', 'Clave de firma no encontrada') : listOnly([key()])));
    renderForm('?replaces=1');
    await userEvent.type(await screen.findByLabelText(/Nombre/), 'Nómina');
    await userEvent.type(screen.getByLabelText(/Clave pública/), PUBLIC_KEY);
    await userEvent.click(screen.getByRole('button', { name: 'Registrar clave' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Registrar la clave «Nómina»?' })).getByRole('button', { name: 'Registrar clave' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo registrar la clave' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByText('Clave de firma no encontrada')).toBeInTheDocument();
  });

  it('si generar el par falla lo dice con su propio título', async () => {
    mockFetch((call) => (call.init.method === 'POST' ? apiFail(503, 'SERVICE_UNAVAILABLE', 'El servicio no está disponible') : listOnly([])));
    renderForm();
    await userEvent.click(await screen.findByRole('radio', { name: 'Que la plataforma genere el par' }));
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Nómina');
    expect(screen.getByRole('button', { name: 'Generar el par' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Generar el par' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Generar el par de «Nómina»?' })).getByRole('button', { name: 'Generar el par' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo generar el par' })).toBeInTheDocument();
  });

  it('si no carga lo que decide el servidor, la pantalla ofrece reintentar en lugar de inventar los límites', async () => {
    let tries = 0;
    mockFetch(() => {
      tries += 1;
      return tries === 1 ? apiFail(500, 'INTERNAL_ERROR', 'Error inesperado') : apiOk(page([]));
    });
    renderForm();
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron cargar las claves de firma' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    expect(await screen.findByLabelText(/Nombre/)).toBeInTheDocument();
  });

  it('en inglés el formulario se lee en inglés', async () => {
    await setLocale('en-US');
    mockFetch(apiOk(page([])));
    renderForm();
    expect(await screen.findByText('Add signing key')).toBeInTheDocument();
    expect(screen.getByText('At most 730 days.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'I register my public key' })).toBeChecked();
  });
});
