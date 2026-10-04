import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { samplePolicy } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { PolicyTuning } from './PolicyTuning';

/** Catálogo donde el nivel "Alto" del anti-spoofing no trae descripción. */
const catalogs = catalogsWith({
  antispoof_levels: catalogsFixture.antispoof_levels.map((level) => (level.code === 'HIGH' ? { ...level, description: null } : level)),
});

const choose = async (control: RegExp, option: string | RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};

describe('PolicyTuning', () => {
  it('nivel guardado que ya no está en el catálogo: texto genérico, "antes" con su código; un nivel sin descripción se guarda con detalle vacío', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, anti_spoofing_level: 'RETIRADO' }} saving={null} onSave={onSave} />, { catalogs });
    expect(screen.getByText('Qué tan estricto es al detectar fotos, pantallas y videos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sensibilidad del anti-spoofing/ })).toHaveTextContent('Selecciona una opción');
    await choose(/Sensibilidad del anti-spoofing/, 'Alto');
    // Sin el nivel vigente en la lista no se sabe si el nuevo protege menos: no se advierte.
    expect(onSave).toHaveBeenCalledWith({
      key: 'anti_spoofing_level',
      changes: { anti_spoofing_level: 'HIGH' },
      title: 'Anti-spoofing: nivel Alto',
      detail: '',
      change: { label: 'Sensibilidad del anti-spoofing', before: 'RETIRADO', after: 'Alto' },
      relaxes: false,
    });
  });

  it('bajar la sensibilidad o los movimientos protege menos; subirlos, no', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, anti_spoofing_level: 'HIGH', liveness_steps: 2 }} saving={null} onSave={onSave} />);
    await choose(/Sensibilidad del anti-spoofing/, /^Estándar/);
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ change: { label: 'Sensibilidad del anti-spoofing', before: 'Alto', after: 'Estándar' }, relaxes: true }));
    await choose(/Sensibilidad del anti-spoofing/, /^Máximo/);
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ change: expect.objectContaining({ after: 'Máximo' }), relaxes: false }));
    await choose(/Movimientos de la prueba de vida/, '1 movimiento');
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ change: { label: 'Movimientos de la prueba de vida', before: '2 movimientos', after: '1 movimiento' }, relaxes: true }));
  });

  it('movimientos de la prueba de vida (1 a 3): la descripción y el detalle dicen cuántos se pedirán', async () => {
    const onSave = vi.fn();
    const two = renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 2 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Dos movimientos aleatorios: un video grabado tendría que acertar la secuencia.')).toBeInTheDocument();
    await choose(/Movimientos de la prueba de vida/, '1 movimiento');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'liveness_steps',
        changes: { liveness_steps: 1 },
        title: 'Prueba de vida actualizada',
        detail: 'Se pedirá 1 movimiento de cabeza al azar (girar, mirar arriba o abajo, acercarse).',
      }),
    );
    await choose(/Movimientos de la prueba de vida/, '3 movimientos');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changes: { liveness_steps: 3 },
        detail: 'Se pedirán 3 movimientos de cabeza al azar (girar, mirar arriba o abajo, acercarse).',
        change: { label: 'Movimientos de la prueba de vida', before: '2 movimientos', after: '3 movimientos' },
        relaxes: false,
      }),
    );

    two.unmount();
    const one = renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 1 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Un movimiento aleatorio (más rápido, menos seguro).')).toBeInTheDocument();
    one.unmount();
    const three = renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 3 }} saving={null} onSave={onSave} />);
    expect(screen.getByText(/Tres movimientos aleatorios: lo más difícil de engañar/)).toBeInTheDocument();
    three.unmount();
    // Un valor que ya no está en la lista (otra versión): texto genérico y se ofrece tal cual.
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 5 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Movimientos de cabeza aleatorios (girar, mirar arriba o abajo, acercarse).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Movimientos de la prueba de vida/ })).toHaveTextContent('5 movimientos');
  });

  it('tiempo de la prueba de vida: menos tiempo es más estricto; el detalle dice cuándo vence cada reto', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_timeout_seconds: 75 }} saving={null} onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Tiempo para la prueba de vida/ })).toHaveTextContent('75 s');
    await choose(/Tiempo para la prueba de vida/, '30 s');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        key: 'liveness_timeout_seconds',
        changes: { liveness_timeout_seconds: 30 },
        title: 'Tiempo de la prueba de vida actualizado',
        detail: 'Cada reto vencerá a los 30 s.',
        change: { label: 'Tiempo para la prueba de vida', before: '75 s', after: '30 s' },
        relaxes: false,
      }),
    );
    await choose(/Tiempo para la prueba de vida/, '3 min');
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ changes: { liveness_timeout_seconds: 180 }, detail: 'Cada reto vencerá a los 3 min.', relaxes: true }));
  });

  it('destello de colores (catálogo flash_modes): exigirlo advierte calibrar antes; apagarlo protege menos', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    expect(screen.getByText(/se mide cómo los refleja el rostro, sin bloquear a nadie/)).toBeInTheDocument(); // modo vigente: Solo medir
    await userEvent.click(screen.getByRole('button', { name: /Destello de colores/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringMatching(/^Apagado/),
      expect.stringMatching(/^Solo medir/),
      expect.stringMatching(/^Obligatorio/),
    ]);
    await userEvent.click(screen.getByRole('option', { name: /^Obligatorio/ }));
    expect(onSave).toHaveBeenLastCalledWith({
      key: 'flash_liveness',
      changes: { flash_liveness: 'ENFORCE' },
      title: 'Destello de colores: Obligatorio',
      detail: 'El rostro debe reflejar los colores que pinta la pantalla: un video inyectado o generado no los ve.',
      warning: expect.stringMatching(/después de calibrar con capturas reales.*luz del sol directa puede pedir repetir/) as string,
      change: { label: 'Destello de colores', before: 'Solo medir', after: 'Obligatorio' },
      relaxes: false,
    });
    await choose(/Destello de colores/, /^Apagado/);
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ changes: { flash_liveness: 'OFF' }, warning: undefined, relaxes: true }));
  });

  it('destello: un modo sin descripción o que ya no está en el catálogo se muestra con su texto genérico', async () => {
    const onSave = vi.fn();
    const bare = catalogsWith({ flash_modes: catalogsFixture.flash_modes.map((mode) => ({ ...mode, description: null })) });
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, flash_liveness: 'RETIRADO' }} saving={null} onSave={onSave} />, { catalogs: bare });
    expect(screen.getByText('La pantalla destella colores y el rostro real debe reflejarlos.')).toBeInTheDocument();
    await choose(/Destello de colores/, 'Solo medir');
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ detail: '', change: { label: 'Destello de colores', before: 'RETIRADO', after: 'Solo medir' }, relaxes: false }));
  });

  it('bloqueo y vigencia del QR: cada ajuste se guarda con su explicación (horas y minutos legibles) y si protege menos', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    await choose(/Intentos antes del bloqueo/, '7 intentos');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'lockout_max_failures', changes: { lockout_max_failures: 7 }, title: 'Bloqueo actualizado', detail: 'Se bloqueará tras 7 intentos fallidos seguidos.', relaxes: true }),
    );
    await choose(/Duración del bloqueo/, '2 h');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'lockout_minutes', changes: { lockout_minutes: 120 }, detail: 'El bloqueo durará 2 h.', change: { label: 'Duración del bloqueo', before: '15 min', after: '2 h' }, relaxes: false }),
    );
    await choose(/Vigencia del código QR/, '5 min');
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ key: 'qr_lifetime_seconds', changes: { qr_lifetime_seconds: 300 }, title: 'Vigencia del QR actualizada', detail: 'Cada código QR durará 5 min y servirá una sola vez.', relaxes: true }),
    );
    await choose(/Vigencia del código QR/, '15 s');
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ change: { label: 'Vigencia del código QR', before: '30 s', after: '15 s' }, relaxes: false }));
  });

  it('un valor vigente que no está en la lista se ofrece con su texto (p. ej. intentos fijados por otra versión)', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, lockout_max_failures: 4 }} saving={null} onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Intentos antes del bloqueo/ })).toHaveTextContent('4 intentos');
    await choose(/Intentos antes del bloqueo/, '3 intentos');
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ change: { label: 'Intentos antes del bloqueo', before: '4 intentos', after: '3 intentos' }, relaxes: false }));
  });
});
