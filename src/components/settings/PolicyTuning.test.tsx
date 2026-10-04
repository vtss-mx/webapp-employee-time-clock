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

const choose = async (control: RegExp, option: string) => {
  await userEvent.click(screen.getByRole('button', { name: control }));
  await userEvent.click(screen.getByRole('option', { name: option }));
};

describe('PolicyTuning', () => {
  it('nivel guardado que ya no está en el catálogo: texto genérico; un nivel sin descripción se guarda con detalle vacío', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, anti_spoofing_level: 'RETIRADO' }} saving={null} onSave={onSave} />, { catalogs });
    expect(screen.getByText('Qué tan estricto es al detectar fotos, pantallas y videos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sensibilidad del anti-spoofing/ })).toHaveTextContent('Selecciona una opción');
    await choose(/Sensibilidad del anti-spoofing/, 'Alto');
    expect(onSave).toHaveBeenCalledWith('anti_spoofing_level', { anti_spoofing_level: 'HIGH' }, 'Anti-spoofing: nivel Alto', '');
  });

  it('giros de la prueba de vida: el detalle dice cuántos se pedirán', async () => {
    const onSave = vi.fn();
    const twoTurns = renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 2 }} saving={null} onSave={onSave} />);
    await choose(/Giros de la prueba de vida/, '1 giro');
    expect(onSave).toHaveBeenLastCalledWith('liveness_steps', { liveness_steps: 1 }, 'Prueba de vida actualizada', 'Se pedirá un giro de cabeza en orden aleatorio.');

    twoTurns.unmount();
    renderWithProviders(<PolicyTuning policy={{ ...samplePolicy, liveness_steps: 1 }} saving={null} onSave={onSave} />);
    expect(screen.getByText('Un giro aleatorio (más rápido, menos seguro).')).toBeInTheDocument();
    await choose(/Giros de la prueba de vida/, '2 giros');
    expect(onSave).toHaveBeenLastCalledWith('liveness_steps', { liveness_steps: 2 }, 'Prueba de vida actualizada', 'Se pedirán dos giros de cabeza en orden aleatorio.');
  });

  it('bloqueo y vigencia del QR: cada ajuste se guarda con su explicación (horas y minutos legibles)', async () => {
    const onSave = vi.fn();
    renderWithProviders(<PolicyTuning policy={samplePolicy} saving={null} onSave={onSave} />);
    await choose(/Intentos antes del bloqueo/, '7 intentos');
    expect(onSave).toHaveBeenLastCalledWith('lockout_max_failures', { lockout_max_failures: 7 }, 'Bloqueo actualizado', 'Se bloqueará tras 7 intentos fallidos seguidos.');
    await choose(/Duración del bloqueo/, '2 h');
    expect(onSave).toHaveBeenLastCalledWith('lockout_minutes', { lockout_minutes: 120 }, 'Bloqueo actualizado', 'El bloqueo durará 2 h.');
    await choose(/Vigencia del código QR/, '5 min');
    expect(onSave).toHaveBeenLastCalledWith('qr_lifetime_seconds', { qr_lifetime_seconds: 300 }, 'Vigencia del QR actualizada', 'Cada código QR durará 5 min y servirá una sola vez.');
  });
});
