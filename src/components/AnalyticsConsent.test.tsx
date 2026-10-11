import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n';

const analytics = vi.hoisted(() => ({ analyticsAvailable: vi.fn(() => true), setAnalyticsConsent: vi.fn() }));
vi.mock('../services/analytics', () => analytics);

const store = vi.hoisted(() => ({ get: vi.fn(() => Promise.resolve(undefined as unknown)), set: vi.fn(() => Promise.resolve()) }));
vi.mock('../utils/deviceStore', () => ({ deviceStore: store }));

const { AnalyticsConsent } = await import('./AnalyticsConsent');

beforeEach(() => {
  analytics.analyticsAvailable.mockReturnValue(true);
  store.get.mockResolvedValue(undefined);
});
afterEach(() => vi.clearAllMocks());

/** La barra solo aparece cuando falta la respuesta de la persona. */
const bar = () => screen.queryByRole('region', { name: 'Medición de uso' });

describe('AnalyticsConsent: se pregunta ANTES de medir', () => {
  it('pregunta cuando no hay respuesta en este dispositivo y acepta', async () => {
    render(<AnalyticsConsent />);
    expect(await screen.findByText('Medimos qué pantallas se usan y con qué rol, nunca datos de la persona. Puedes rechazarlo.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith('granted');
    expect(store.set).toHaveBeenCalledWith('analyticsConsent', 'granted');
    await waitFor(() => expect(bar()).toBeNull());
  });

  it('rechazar también se recuerda y no degrada nada', async () => {
    render(<AnalyticsConsent />);
    await userEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));
    expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith('denied');
    expect(store.set).toHaveBeenCalledWith('analyticsConsent', 'denied');
    expect(bar()).toBeNull();
  });

  it('con una respuesta guardada no vuelve a preguntar: la aplica y calla', async () => {
    store.get.mockResolvedValue('denied');
    render(<AnalyticsConsent />);
    await waitFor(() => expect(analytics.setAnalyticsConsent).toHaveBeenCalledWith('denied'));
    expect(bar()).toBeNull();
  });

  it('un valor guardado que no reconoce se trata como «sin respuesta»', async () => {
    store.get.mockResolvedValue('lo-que-sea');
    render(<AnalyticsConsent />);
    expect(await screen.findByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(analytics.setAnalyticsConsent).not.toHaveBeenCalled();
  });

  it('sin analítica configurada en este despliegue no pregunta nada', async () => {
    analytics.analyticsAvailable.mockReturnValue(false);
    render(<AnalyticsConsent />);
    await waitFor(() => expect(store.get).not.toHaveBeenCalled());
    expect(bar()).toBeNull();
  });

  it('si la pantalla se cierra antes de leer el dispositivo, no intenta dibujar', async () => {
    let settle: (value: unknown) => void = () => undefined;
    store.get.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const { unmount } = render(<AnalyticsConsent />);
    unmount();
    settle(undefined);
    await waitFor(() => expect(bar()).toBeNull());
    expect(analytics.setAnalyticsConsent).not.toHaveBeenCalled();
  });

  it('se lee en el idioma de la persona (cambio en caliente)', async () => {
    render(<AnalyticsConsent />);
    expect(await screen.findByText('Medición de uso')).toBeInTheDocument();
    await setLocale('en-US');
    expect(await screen.findByText('Usage measurement')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });
});
