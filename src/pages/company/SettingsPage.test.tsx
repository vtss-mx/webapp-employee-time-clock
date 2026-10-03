import { act, fireEvent, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfidenceSlider } from '../../components/ConfidenceSlider';
import { AccessoryReviewPrompt } from '../../components/LiveFaceFlow';
import { catalogsFixture, catalogsWith } from '../../test/catalogs';
import { publishPolicy, resetPolicyCache, useVerificationPolicy } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk, mockFetch } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import { SettingsPage } from './SettingsPage';

const policy = { ...samplePolicy, updated_at: '2026-10-01T10:00:00Z', updated_by: 'admin@empresa.com' };

afterEach(() => resetPolicyCache());

describe('SettingsPage (COMPANY)', () => {
  it('candados contra suplantación: cada uno se desactiva con confirmación y sus ajustes se guardan', async () => {
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderWithProviders(<SettingsPage />);
    const lock = await screen.findByRole('switch', { name: 'Bloquear cámaras virtuales' });
    expect(lock).toHaveAttribute('aria-checked', 'true');
    for (const name of ['Solo capturas en vivo', 'Detectar fotos fijas', 'Detectar capturas reutilizadas', 'Exigir una sola toma', 'Tiempo humano en la prueba de vida', 'Detectar rostros duplicados', 'Bloqueo por intentos fallidos']) {
      expect(screen.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
    }
    await userEvent.click(lock);
    const confirm = await screen.findByRole('alertdialog', { name: 'Desactivar bloquear cámaras virtuales' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(lock).toHaveAttribute('aria-checked', 'false'));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    // Ajustes: nivel de anti-spoofing (catálogo), giros y bloqueo.
    await userEvent.click(screen.getByRole('button', { name: /Sensibilidad del anti-spoofing/ }));
    await userEvent.click(screen.getByRole('option', { name: /Máximo/ }));
    expect(await screen.findByText('Anti-spoofing: nivel Máximo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getByRole('button', { name: /Giros de la prueba de vida/ }));
    await userEvent.click(screen.getByRole('option', { name: '1 giro' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getByRole('button', { name: /Intentos antes del bloqueo/ }));
    await userEvent.click(screen.getByRole('option', { name: '3 intentos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    await userEvent.click(screen.getByRole('button', { name: /Duración del bloqueo/ }));
    await userEvent.click(screen.getByRole('option', { name: '1 h' }));
    await waitFor(() => expect(calls.filter((c) => c.init.method === 'PUT')).toHaveLength(5));
    expect(calls.filter((c) => c.init.method === 'PUT').map((c) => JSON.parse(c.init.body as string) as object)).toEqual([
      { block_virtual_cameras: false },
      { anti_spoofing_level: 'MAXIMUM' },
      { liveness_steps: 1 },
      { lockout_max_failures: 3 },
      { lockout_minutes: 60 },
    ]);
  });

  it('los ajustes de un candado apagado no se pueden cambiar', async () => {
    mockFetch(apiOk({ ...policy, anti_spoofing: false, liveness_challenge: false, lockout_enabled: false }));
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByRole('button', { name: /Sensibilidad del anti-spoofing/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Giros de la prueba de vida/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Intentos antes del bloqueo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Duración del bloqueo/ })).toBeDisabled();
  });

  it('nivel de confianza: control de 80 % a 100 % (100 = 99.999 %), guardado explícito y confirmación si es muy estricto', async () => {
    const { calls } = mockFetch((call) => {
      if (call.init.method !== 'PUT') return apiOk(policy);
      return apiOk({ ...policy, ...(JSON.parse(call.init.body as string) as object) });
    });
    renderWithProviders(<SettingsPage />);
    const slider = await screen.findByRole('slider', { name: 'Nivel de confianza requerido' });
    expect(slider).toHaveValue('100'); // 99.999 % por defecto
    expect(slider).toHaveAttribute('aria-valuetext', '99.999 % (Máximo)');
    expect(slider).toHaveAttribute('min', '80');
    const save = screen.getByRole('button', { name: 'Guardar nivel' });
    expect(save).toBeDisabled(); // sin cambios

    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider).toHaveAttribute('aria-valuetext', '80 % (Flexible)');
    expect(screen.getByText('0.386')).toBeInTheDocument(); // similitud exigida al 80 %
    fireEvent.change(slider, { target: { value: '95' } });
    expect(screen.getByText('0.427')).toBeInTheDocument(); // similitud exigida a ese nivel
    await userEvent.click(save);
    await waitFor(() => expect(slider).toHaveValue('95'));
    expect(JSON.parse(calls.filter((c) => c.init.method === 'PUT').at(-1)?.init.body as string)).toEqual({ min_confidence: 0.95 });
    expect(await screen.findByText('Nivel de confianza actualizado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' })); // confirmación en popup

    // Volver al máximo pide confirmación (más reintentos) y explica que 100 % = 99.999 %.
    fireEvent.change(slider, { target: { value: '100' } });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar nivel' }));
    const dialog = await screen.findByRole('alertdialog', { name: '¿Exigir 99.999 % de confianza?' });
    expect(within(dialog).getByText(/puede garantizar el 100 %/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar nivel' }));
    await waitFor(() =>
      expect(JSON.parse(calls.filter((c) => c.init.method === 'PUT').at(-1)?.init.body as string)).toEqual({ min_confidence: 0.99999 }),
    );
  });

  it('controla el acceso solo desde teléfono con una confirmación específica', async () => {
    const { calls } = mockFetch((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, employee_mobile_only: false }) : apiOk(policy),
    );
    renderWithProviders(<SettingsPage />);
    const mobileOnly = await screen.findByRole('switch', { name: 'Solo desde teléfono celular' });
    expect(mobileOnly).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(mobileOnly);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/computadoras y tabletas compartidas/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(mobileOnly).toHaveAttribute('aria-checked', 'false'));
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')?.init.body as string)).toEqual({ employee_mobile_only: false });
  });

  it('validadores solo desde tableta o teléfono (confirmación propia al desactivarlo)', async () => {
    const { calls } = mockFetch((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, validator_mobile_only: false }) : apiOk(policy),
    );
    renderWithProviders(<SettingsPage />);
    const touchOnly = await screen.findByRole('switch', { name: 'Validadores solo desde tableta o teléfono' });
    expect(touchOnly).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(touchOnly);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/podrán operar desde computadoras/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(touchOnly).toHaveAttribute('aria-checked', 'false'));
    expect(JSON.parse(calls.find((c) => c.init.method === 'PUT')?.init.body as string)).toEqual({ validator_mobile_only: false });
  });

  it('muestra la política y guarda un cambio al instante', async () => {
    const { calls } = mockFetch((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, block_mask: false }) : apiOk(policy),
    );
    renderWithProviders(<SettingsPage />);
    // Un interruptor por accesorio del catálogo, nombrado con su frase.
    expect(await screen.findByRole('switch', { name: 'Retirar la gorra o sombrero' })).toBeInTheDocument();
    const mask = screen.getByRole('switch', { name: 'Retirar el cubrebocas' });
    expect(mask).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/Última modificación/)).toBeNull(); // etiqueta retirada a pedido del usuario

    await userEvent.click(mask);
    await waitFor(() => expect(mask).toHaveAttribute('aria-checked', 'false'));
    const put = calls.find((c) => c.init.method === 'PUT');
    expect(JSON.parse(put?.init.body as string)).toEqual({ block_mask: false });
    expect(await screen.findByText('Retirar el cubrebocas: desactivado')).toBeInTheDocument();
  });

  it('pide confirmación para desactivar una protección de seguridad', async () => {
    const { calls } = mockFetch((call) =>
      call.init.method === 'PUT' ? apiOk({ ...policy, anti_spoofing: false }) : apiOk(policy),
    );
    renderWithProviders(<SettingsPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Anti-spoofing' }));
    const dialog = screen.getByRole('alertdialog');
    expect(calls.some((c) => c.init.method === 'PUT')).toBe(false); // aún no se guarda
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Anti-spoofing' })).toHaveAttribute('aria-checked', 'false'));
  });

  it('revierte el interruptor si el guardado falla', async () => {
    mockFetch((call) => (call.init.method === 'PUT' ? apiFail(503, 'SERVER_BUSY', 'Ocupado') : apiOk(policy)));
    renderWithProviders(<SettingsPage />);
    const glasses = await screen.findByRole('switch', { name: 'Retirar los lentes' });
    await userEvent.click(glasses);
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(glasses).toHaveAttribute('aria-checked', 'true');
  });

  it('informa errores al cargar', async () => {
    mockFetch(apiFail(403, 'FORBIDDEN', 'Sin permisos'));
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Sin permisos')).toBeInTheDocument();
  });
});

describe('ConfidenceSlider: niveles del catálogo confidence_levels', () => {
  it('solo niveles activos; una posición sin nivel se ajusta al más cercano', () => {
    const confidence_levels = catalogsFixture.confidence_levels.map((l) => (l.code === '85' || l.code === '100' ? { ...l, active: false } : l));
    const { container } = renderWithProviders(<ConfidenceSlider value={0.99999} onSave={() => undefined} />, {
      catalogs: catalogsWith({ confidence_levels }),
    });
    const slider = screen.getByRole('slider', { name: 'Nivel de confianza requerido' });
    expect(slider).toHaveAttribute('max', '99'); // el máximo activo
    expect(slider).toHaveAttribute('aria-valuetext', '99 % (Estricto)'); // valor guardado ya inactivo: el más cercano
    expect(container.querySelectorAll('.confidence__tick')).toHaveLength(19);
    fireEvent.change(slider, { target: { value: '85' } });
    expect(slider).toHaveAttribute('aria-valuetext', '84 % (Flexible)');
    expect(slider).toHaveValue('84');

    fireEvent.click(screen.getByText('90')); // marca del control
    expect(slider).toHaveAttribute('aria-valuetext', '90 % (Equilibrado)');
    fireEvent.click(screen.getByRole('button', { name: 'Restablecer' }));
    expect(slider).toHaveAttribute('aria-valuetext', '99 % (Estricto)');
  });

  it('sin niveles activos no muestra el control', () => {
    renderWithProviders(<ConfidenceSlider value={0.9} onSave={() => undefined} />, { catalogs: catalogsWith({ confidence_levels: [] }) });
    expect(screen.queryByRole('slider')).toBeNull();
  });
});

describe('useVerificationPolicy', () => {
  it('usa valores estrictos hasta cargar y se actualiza al publicar cambios', async () => {
    mockFetch(apiOk({ ...policy, qr_enabled: false }));
    const { result } = renderHook(() => useVerificationPolicy());
    expect(result.current.policy.block_mask).toBe(true);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.policy.qr_enabled).toBe(false);
    act(() => publishPolicy({ ...policy, block_glasses: false }));
    expect(result.current.policy.block_glasses).toBe(false);
  });
});

describe('AccessoryReviewPrompt', () => {
  it('ofrece enviar a revisión con los accesorios detectados', async () => {
    let confirmed = false;
    renderWithProviders(<AccessoryReviewPrompt accessories={['MASK']} onConfirm={() => (confirmed = true)} />);
    expect(screen.getByText('¿No estás usando el cubrebocas?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /No uso el cubrebocas/ }));
    expect(confirmed).toBe(true);
  });
});
