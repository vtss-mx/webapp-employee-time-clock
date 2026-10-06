import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { apiFail, apiOk, mockFetch, type MockCall } from '../test/http';
import { chooseFiles } from '../test/files';
import { loaded, usePointerEvents } from '../test/pointer';
import { renderWithProviders, sampleUser } from '../test/render';
import type { User } from '../types';
import { ProfilePhotoSection } from './ProfilePhotoSection';

const session = vi.hoisted(() => ({ user: null as User | null, updateAvatar: vi.fn<(avatar: string | null) => void>() }));
vi.mock('../hooks/useAuth', () => ({ useAuth: () => session }));

const withPhoto = (user: User): User => ({ ...user, avatar: '/users/1/avatar?v=old' });
const image = apiOk({ user_id: 1, size_px: 512, version: 'old', content_type: 'image/webp', data: btoa('RIFF') });
const saved = apiOk({ avatar: '/users/1/avatar?v=new', version: 'new' });

/** El backend: la foto vigente y lo que responda al subirla o quitarla. */
function server(change: Response = saved) {
  return mockFetch((call: MockCall) => (call.url.includes('/avatar?') ? image : change));
}

async function pickAndCrop() {
  await userEvent.click(screen.getByRole('button', { name: /Agregar foto|Cambiar foto/ }));
  chooseFiles(screen.getByLabelText('Nueva foto de perfil'), new File([new Uint8Array(4096)], 'yo.jpg', { type: 'image/jpeg' }));
  const photo = screen.getByRole('group', { name: 'Recorte de la foto' }).querySelector('img') as HTMLImageElement;
  loaded(photo, 900, 600);
  fireEvent.load(photo);
  await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }));
  return screen.findByRole('dialog'); // crear o cambiar: confirmación azul (quitar es roja: alertdialog)
}

beforeEach(() => {
  usePointerEvents();
  session.user = sampleUser;
  session.updateAvatar.mockReset();
  let n = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:x-${(n += 1)}`), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('ProfilePhotoSection (Mi perfil → Foto de perfil)', () => {
  it('primera foto: confirma qué se guarda (vista previa, archivo y peso en MB), la sube y la aplica sin aviso extra', async () => {
    const { calls } = server();
    renderWithProviders(<ProfilePhotoSection />);
    expect(screen.getByRole('heading', { name: 'Foto de perfil' })).toBeInTheDocument();
    const ask = await pickAndCrop();
    expect(within(ask).getByRole('heading', { name: '¿Guardar esta foto de perfil?' })).toBeInTheDocument();
    expect(within(ask).getByRole('img', { name: 'Así se verá tu foto', hidden: true })).toBeInTheDocument(); // en el ícono
    expect(within(ask).getByText('yo.jpg · < 0.01 MB')).toBeInTheDocument();
    expect(within(ask).getByText(/se quitan la ubicación y los datos de la cámara/)).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Guardar foto' }));
    await waitFor(() => expect(session.updateAvatar).toHaveBeenCalledWith('/users/1/avatar?v=new'));
    const upload = calls.find((call) => call.init.method === 'PUT') as MockCall;
    const body = upload.init.body as FormData;
    expect([body.get('crop_x'), body.get('crop_y'), body.get('crop_size')]).toEqual(['150', '0', '600']);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()); // sin popup de éxito: la foto ya se ve
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cancelar la confirmación no sube nada y deja el recorte como estaba', async () => {
    const { calls } = server();
    renderWithProviders(<ProfilePhotoSection />);
    const ask = await pickAndCrop();
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(calls.some((call) => call.init.method === 'PUT')).toBe(false);
    expect(screen.getByRole('group', { name: 'Recorte de la foto' })).toBeInTheDocument();
  });

  it('cambiar la foto avisa que la anterior se elimina; si el servidor falla, el popup lo explica y el recorte sigue', async () => {
    session.user = withPhoto(sampleUser);
    server(apiFail(503, 'STORAGE_UNAVAILABLE', 'El almacenamiento de imágenes no está disponible'));
    renderWithProviders(<ProfilePhotoSection />);
    const ask = await pickAndCrop();
    expect(within(ask).getByRole('heading', { name: '¿Cambiar tu foto de perfil?' })).toBeInTheDocument();
    expect(within(ask).getByText(/Tu foto anterior se elimina/)).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Guardar foto' }));
    const failed = await screen.findByRole('alertdialog', { name: 'No se pudo guardar tu foto' });
    expect(within(failed).getByText('El almacenamiento de imágenes no está disponible')).toBeInTheDocument();
    expect(session.updateAvatar).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Recorte de la foto' })).toBeInTheDocument();
  });

  it('quitar la foto pregunta con la foto vigente y, al confirmar, vuelven las iniciales', async () => {
    session.user = withPhoto({ ...sampleUser, employee: null, role: 'COMPANY', email: 'rh@empresa.com' });
    const { calls } = server(apiOk({ avatar: null, version: null }));
    renderWithProviders(<ProfilePhotoSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    const ask = await screen.findByRole('alertdialog', { name: '¿Quitar tu foto de perfil?' });
    expect(within(ask).getByText('La foto se elimina y no se puede recuperar.')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Quitar foto' }));
    await waitFor(() => expect(session.updateAvatar).toHaveBeenCalledWith(null));
    expect(calls.some((call) => call.init.method === 'DELETE')).toBe(true);
  });

  it('si quitarla falla se explica en un popup; los textos y la confirmación abierta cambian de idioma en caliente', async () => {
    session.user = withPhoto(sampleUser);
    server(apiFail(500, 'INTERNAL_ERROR', 'falló'));
    renderWithProviders(<ProfilePhotoSection />);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    const ask = await screen.findByRole('alertdialog');
    await act(() => setLocale('en-US'));
    expect(within(ask).getByRole('heading', { name: 'Remove your profile photo?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile photo' })).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Remove photo' }));
    expect(await screen.findByRole('alertdialog', { name: "Couldn't remove your photo" })).toBeInTheDocument();
  });

  it('sin sesión no dibuja nada', () => {
    session.user = null;
    const { container } = renderWithProviders(<ProfilePhotoSection />);
    expect(container).toBeEmptyDOMElement();
  });
});
