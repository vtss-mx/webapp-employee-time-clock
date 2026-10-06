import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import type { AvatarCrop } from '../../types/avatar';
import { chooseFiles } from '../../test/files';
import { loaded, usePointerEvents } from '../../test/pointer';
import { config } from '../../utils/config';
import { AvatarUploader, type AvatarUploaderBusy } from './AvatarUploader';

const revoke = vi.fn();
const photo = (name = 'yo.jpg', type = 'image/jpeg', bytes = 2048) => new File([new Uint8Array(bytes)], name, { type });

beforeEach(() => {
  usePointerEvents();
  revoke.mockReset();
  let n = 0;
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:elegida-${(n += 1)}`), revokeObjectURL: revoke });
});
afterEach(() => vi.unstubAllGlobals());

function setup(props: { src?: string | null; busy?: AvatarUploaderBusy; onSave?: () => Promise<boolean>; onRemove?: (current: ReactNode) => Promise<boolean> } = {}) {
  const onSave = vi.fn<(file: File, crop: AvatarCrop, preview: ReactNode) => Promise<boolean>>(props.onSave ?? (() => Promise.resolve(true)));
  const result = render(<AvatarUploader name="Ana Ruiz" src={props.src} busy={props.busy} onSave={onSave} onRemove={props.onRemove} />);
  return { ...result, onSave };
}

/** "Cambiar foto" → elegir un archivo en el selector propio (input oculto). */
async function choose(file: File) {
  await userEvent.click(screen.getByRole('button', { name: /Agregar foto|Cambiar foto/ }));
  chooseFiles(screen.getByLabelText('Nueva foto de perfil'), file);
}

function load(width = 1000, height = 600) {
  const image = screen.getByRole('group', { name: 'Recorte de la foto' }).querySelector('img') as HTMLImageElement;
  loaded(image, width, height);
  fireEvent.load(image);
}

describe('AvatarUploader', () => {
  it('sin foto: iniciales y "Agregar foto"; elegir, recortar y guardar con la vista previa', async () => {
    const { onSave, container } = setup();
    expect(screen.getByRole('img', { name: 'Foto de perfil de Ana Ruiz' })).toHaveTextContent('AR');
    expect(screen.queryByRole('button', { name: 'Quitar foto' })).not.toBeInTheDocument();
    await choose(photo());
    expect(screen.getByRole('button', { name: 'Guardar foto' })).toBeDisabled(); // aún carga
    load();
    fireEvent.keyDown(screen.getByRole('group', { name: 'Recorte de la foto' }), { key: '+' }); // acercar 0.1
    await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }));
    expect(onSave).toHaveBeenCalledWith(expect.any(File), { x: 228, y: 28, size: 545 }, expect.anything());
    const preview = onSave.mock.calls[0][2];
    render(<>{preview}</>);
    expect(screen.getByRole('img', { name: 'Así se verá tu foto' })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('.avatar-uploader--editing')).toBeNull());
    expect(revoke).toHaveBeenCalledWith('blob:elegida-1'); // la foto elegida se libera al terminar
  });

  it('si no se guardó (canceló la confirmación o falló) el recorte sigue como estaba', async () => {
    setup({ onSave: () => Promise.resolve(false) });
    await choose(photo());
    load();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar foto' }));
    expect(screen.getByRole('group', { name: 'Recorte de la foto' })).toBeInTheDocument();
  });

  it('revisa tipo, tamaño (en MB) y lado mínimo antes de subir; el navegador que no la abre también avisa', async () => {
    setup();
    await choose(photo('foto.gif', 'image/gif'));
    expect(screen.getByText('Elige una imagen JPG, PNG o WEBP.')).toBeInTheDocument();
    const input = () => screen.getByLabelText('Nueva foto de perfil');
    chooseFiles(input(), photo('grande.jpg', 'image/jpeg', config.avatarMaxMb * 1024 * 1024 + 1));
    expect(screen.getByText(/La foto pesa 5\.00 MB y el máximo es 5\.00 MB\./)).toBeInTheDocument();
    chooseFiles(input()); // canceló el diálogo
    expect(screen.getByText(/La foto pesa/)).toBeInTheDocument();
    chooseFiles(input(), photo('sin-tipo', ''));
    load(100, 90);
    expect(screen.getByText(`La imagen es muy pequeña: cada lado debe medir al menos ${config.avatarMinSidePx} px.`)).toBeInTheDocument();
    chooseFiles(input(), photo('foto.heic', 'image/webp'));
    fireEvent.error(screen.getByRole('group').querySelector('img') as HTMLImageElement);
    expect(screen.getByText(/Este navegador no pudo abrir la imagen/)).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    expect(screen.getByText(/This browser can't open the image/)).toBeInTheDocument(); // el aviso cambia de idioma
  });

  it('"Elegir otra" vuelve al selector y "Cancelar" deja la foto como estaba', async () => {
    setup({ src: '/users/1/avatar?v=a' });
    await choose(photo());
    load();
    await userEvent.click(screen.getByRole('button', { name: 'Elegir otra' }));
    expect(screen.getByLabelText('Nueva foto de perfil')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    await choose(photo());
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
  });

  it('con foto: "Quitar foto" entrega la foto vigente para la confirmación; mientras trabaja, todo espera', async () => {
    const onRemove = vi.fn(() => Promise.resolve(true));
    const { rerender, onSave } = setup({ src: '/users/1/avatar?v=a', onRemove });
    await userEvent.click(screen.getByRole('button', { name: 'Quitar foto' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    rerender(<AvatarUploader name="Ana Ruiz" src="/users/1/avatar?v=a" busy="remove" onSave={onSave} onRemove={onRemove} />);
    expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Quitar foto/ })).toBeDisabled();
    // Guardando: el recorte se bloquea y muestra el avance.
    rerender(<AvatarUploader name="Ana Ruiz" src="/users/1/avatar?v=a" onSave={onSave} onRemove={onRemove} />);
    await choose(photo());
    load();
    rerender(<AvatarUploader name="Ana Ruiz" src="/users/1/avatar?v=a" busy="save" onSave={onSave} onRemove={onRemove} />);
    expect(screen.getByRole('status')).toHaveTextContent('Subiendo tu foto…');
    expect(screen.getByRole('button', { name: /Elegir otra/ })).toBeDisabled();
  });
});
