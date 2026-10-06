import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { setLocale } from '../../i18n/core';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { samplePolicy } from '../../test/fixtures';
import { renderWithProviders } from '../../test/render';
import { PolicyTuning, type TuningSave } from './PolicyTuning';

/** Catálogo donde el nivel "Alto" del anti-spoofing no trae descripción. */
const catalogs = catalogsWith({
  antispoof_levels: catalogsFixture.antispoof_levels.map((level) => (level.code === 'HIGH' ? { ...level, description: null } : level)),
});

/** El último ajuste elegido con sus textos ya traducidos (son funciones: se piden al dibujarse, en el idioma activo). */
const lastSave = (onSave: Mock<(save: TuningSave) => void>) => {
  const { title, detail, warning, change, ...rest } = onSave.mock.lastCall![0];
  return { ...rest, title: title(), detail: detail(), warning: warning?.(), change: change() };
};

const choose = async (control: RegExp, option: string | RegExp) => {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};

describe('PolicyTuning', () => {
  it('nivel guardado que ya no está en el catálogo: texto genérico, "antes" con su código; un nivel sin descripción se guarda con detalle vacío', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, anti_spoofing_level: 'RETIRADO' }} saving={null} onSave={onSave} />, { catalogs });
    expect(screen.getByText('Qué tan estricto es al detectar fotos, pantallas y videos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sensibilidad del anti-spoofing/ })).toHaveTextContent('Selecciona una opción');
    await choose(/Sensibilidad del anti-spoofing/, 'Alto');
    // Sin el nivel vigente en la lista no se sabe si el nuevo protege menos: no se advierte.
    expect(lastSave(onSave)).toEqual({
      key: 'anti_spoofing_level',
      changes: { anti_spoofing_level: 'HIGH' },
      title: 'Anti-spoofing: nivel Alto',
      detail: '',
      change: { label: 'Sensibilidad del anti-spoofing', before: 'RETIRADO', after: 'Alto' },
      relaxes: false,
    });
  });

  it('bajar la sensibilidad o los movimientos protege menos; subirlos, no', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, anti_spoofing_level: 'HIGH', liveness_steps: 2 }} saving={null} onSave={onSave} />);
    await choose(/Sensibilidad del anti-spoofing/, /^Estándar/);
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ change: { label: 'Sensibilidad del anti-spoofing', before: 'Alto', after: 'Estándar' }, relaxes: true }));
    await choose(/Sensibilidad del anti-spoofing/, /^Máximo/);
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ change: expect.objectContaining({ after: 'Máximo' }), relaxes: false }));
    await choose(/Movimientos de la prueba de vida/, '1 movimiento');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ change: { label: 'Movimientos de la prueba de vida', before: '2 movimientos', after: '1 movimiento' }, relaxes: true }));
  });

  it('movimientos de la prueba de vida (1 a 3): la descripción y el detalle dicen cuántos se pedirán', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    const two = renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 2 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Dos movimientos aleatorios: un video grabado tendría que acertar la secuencia.')).toBeInTheDocument();
    await choose(/Movimientos de la prueba de vida/, '1 movimiento');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({
        key: 'liveness_steps',
        changes: { liveness_steps: 1 },
        title: 'Prueba de vida actualizada',
        detail: 'Se pedirá 1 movimiento de cabeza al azar.',
      }),
    );
    await choose(/Movimientos de la prueba de vida/, '3 movimientos');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({
        changes: { liveness_steps: 3 },
        detail: 'Se pedirán 3 movimientos de cabeza al azar.',
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
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_timeout_seconds: 75 }} saving={null} onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Tiempo para la prueba de vida/ })).toHaveTextContent('75 s');
    await choose(/Tiempo para la prueba de vida/, '30 s');
    expect(lastSave(onSave)).toEqual(
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
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ changes: { liveness_timeout_seconds: 180 }, detail: 'Cada reto vencerá a los 3 min.', relaxes: true }));
  });

  it('destello de colores (catálogo flash_modes): exigirlo advierte calibrar antes; apagarlo protege menos', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    expect(screen.getByText(/se mide cómo los refleja el rostro, sin bloquear a nadie/)).toBeInTheDocument(); // modo vigente: Solo medir
    await userEvent.click(screen.getByRole('button', { name: /Destello de colores/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringMatching(/^Apagado/),
      expect.stringMatching(/^Solo medir/),
      expect.stringMatching(/^Obligatorio/),
    ]);
    await userEvent.click(screen.getByRole('option', { name: /^Obligatorio/ }));
    expect(lastSave(onSave)).toEqual({
      key: 'flash_liveness',
      changes: { flash_liveness: 'ENFORCE' },
      title: 'Destello de colores: Obligatorio',
      detail: 'El rostro debe reflejar los colores que pinta la pantalla: un video inyectado o generado no los ve.',
      warning: expect.stringMatching(/después de calibrar con capturas reales.*luz del sol directa puede pedir repetir/) as string,
      change: { label: 'Destello de colores', before: 'Solo medir', after: 'Obligatorio' },
      relaxes: false,
    });
    await choose(/Destello de colores/, /^Apagado/);
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ changes: { flash_liveness: 'OFF' }, warning: undefined, relaxes: true }));
  });

  it('destello: un modo sin descripción o que ya no está en el catálogo se muestra con su texto genérico', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    const bare = catalogsWith({ flash_modes: catalogsFixture.flash_modes.map((mode) => ({ ...mode, description: null })) });
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, flash_liveness: 'RETIRADO' }} saving={null} onSave={onSave} />, { catalogs: bare });
    expect(screen.getByText('La pantalla destella colores y el rostro real debe reflejarlos.')).toBeInTheDocument();
    await choose(/Destello de colores/, 'Solo medir');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ detail: '', change: { label: 'Destello de colores', before: 'RETIRADO', after: 'Solo medir' }, relaxes: false }));
  });

  it('bloqueo y vigencia del QR: cada ajuste se guarda con su explicación (horas y minutos legibles) y si protege menos', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    await choose(/Intentos antes del bloqueo/, '7 intentos');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ key: 'lockout_max_failures', changes: { lockout_max_failures: 7 }, title: 'Bloqueo actualizado', detail: 'Se bloqueará tras 7 intentos fallidos seguidos.', relaxes: true }),
    );
    await choose(/Duración del bloqueo/, '2 h');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ key: 'lockout_minutes', changes: { lockout_minutes: 120 }, detail: 'El bloqueo durará 2 h.', change: { label: 'Duración del bloqueo', before: '15 min', after: '2 h' }, relaxes: false }),
    );
    await choose(/Vigencia del código QR/, '5 min');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ key: 'qr_lifetime_seconds', changes: { qr_lifetime_seconds: 300 }, title: 'Vigencia del QR actualizada', detail: 'Cada código QR durará 5 min y servirá una sola vez.', relaxes: true }),
    );
    await choose(/Vigencia del código QR/, '15 s');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ change: { label: 'Vigencia del código QR', before: '30 s', after: '15 s' }, relaxes: false }));
  });

  it('un valor vigente que no está en la lista se ofrece con su texto (p. ej. intentos fijados por otra versión)', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, lockout_max_failures: 4 }} saving={null} onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Intentos antes del bloqueo/ })).toHaveTextContent('4 intentos');
    await choose(/Intentos antes del bloqueo/, '3 intentos');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ change: { label: 'Intentos antes del bloqueo', before: '4 intentos', after: '3 intentos' }, relaxes: false }));
  });

  it('en-US: ajustes, opciones y unidades en inglés; un ajuste elegido sigue al idioma si cambia con su confirmación abierta', async () => {
    await setLocale('en-US');
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, lockout_max_failures: 4, max_location_accuracy_m: 1000 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Lockout duration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Attempts before lockout/ })).toHaveTextContent('4 attempts');
    expect(screen.getByRole('button', { name: /Location accuracy/ })).toHaveTextContent('Up to 1 km');
    expect(screen.getByRole('button', { name: /Minimum capture quality/ })).toHaveTextContent('Basic');
    await choose(/Liveness check moves/, '1 move');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({
        title: 'Liveness check updated',
        detail: '1 random head move will be requested.',
        change: { label: 'Liveness check moves', before: '2 moves', after: '1 move' },
      }),
    );
    await choose(/Lockout duration/, '2 h');
    // El mismo ajuste elegido, ya en español: sus textos se piden de nuevo al dibujarse.
    await act(() => setLocale('es-MX'));
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ title: 'Bloqueo actualizado', detail: 'El bloqueo durará 2 h.', change: { label: 'Duración del bloqueo', before: '15 min', after: '2 h' } }),
    );
  });

  it('calidad mínima: niveles con nombre, un valor propio en porcentaje y "sin mínimo" acepta cualquier captura', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, min_capture_quality: 0.62 }} saving={null} onSave={onSave} />);
    expect(screen.getByRole('button', { name: /Calidad mínima de la captura/ })).toHaveTextContent('62 %');
    await choose(/Calidad mínima de la captura/, 'Alta');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ title: 'Calidad mínima actualizada', detail: 'Se rechazarán las capturas con calidad menor a «Alta».', relaxes: false }));
    await choose(/Calidad mínima de la captura/, 'Sin mínimo');
    expect(lastSave(onSave)).toEqual(expect.objectContaining({ detail: 'Se acepta cualquier captura que pase los controles básicos.', relaxes: true }));
  });

  it('ubicación: precisión en metros o kilómetros y velocidad en km/h, cada una con su explicación', async () => {
    const onSave = vi.fn<(save: TuningSave) => void>();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    await choose(/Precisión de la ubicación/, 'Hasta 1 km');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ title: 'Precisión actualizada', detail: 'Se pedirá repetir el registro si la ubicación tiene un margen mayor a 1 km.', relaxes: true }),
    );
    await choose(/Velocidad máxima creíble/, '120 km/h');
    expect(lastSave(onSave)).toEqual(
      expect.objectContaining({ title: 'Velocidad actualizada', detail: 'Se rechazarán registros que exijan viajar a más de 120 km/h desde el anterior.' }),
    );
  });
});
