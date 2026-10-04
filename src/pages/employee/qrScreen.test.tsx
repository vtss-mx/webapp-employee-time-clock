import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DynamicQrPhase, useDynamicQr } from '../../hooks/useDynamicQr';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiOk, mockFetch } from '../../test/http';
import { renderWithProviders, sampleUser } from '../../test/render';
import type { DynamicQr, User } from '../../types';
import { MyQrPage } from './MyQrPage';

/**
 * La pantalla con cada fase del código (el ciclo real del QR se prueba en MyQrPage.test.tsx y en
 * las pruebas del hook): qué muestra y qué pide en cada una.
 */
const state = vi.hoisted((): { user: User | null; code: ReturnType<typeof useDynamicQr> } => ({
  user: null,
  code: { qr: null, phase: 'loading', error: null, deadline: 0, renew: vi.fn<() => Promise<void>>() },
}));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('../../hooks/useDynamicQr', () => ({ useDynamicQr: () => state.code }));
vi.mock('qrcode', () => ({ toDataURL: (text: string) => Promise.resolve(`data:image/png;base64,${text}`) }));

const qr: DynamicQr = { id: 1, employee_number: 'EMP-7', created_at: 'x', expires_at: 'y', lifetime_seconds: 30, content: 'TCQR2:token-1' };
const show = (phase: DynamicQrPhase) => {
  state.code = { ...state.code, qr, phase, deadline: Date.now() + 30_000 };
};

beforeEach(() => {
  state.user = sampleUser;
  state.code.renew = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  mockFetch(apiOk(samplePolicy));
});
afterEach(() => resetPolicyCache());

describe('MyQrPage: fases del código', () => {
  it('reemplazado en otro dispositivo: no corre la cuenta y "Mostrar un código nuevo" pide otro', async () => {
    show('replaced');
    renderWithProviders(<MyQrPage />);
    expect(screen.getByText('Este código se reemplazó')).toBeInTheDocument();
    expect(screen.queryByText(/Se renueva en/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar un código nuevo' }));
    expect(state.code.renew).toHaveBeenCalledOnce();
  });

  it('recién usado: "Generar otro" queda ocupado mientras llega el siguiente', () => {
    show('used');
    renderWithProviders(<MyQrPage />);
    expect(screen.getByText('¡Listo!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generar otro/ })).toBeDisabled();
  });

  it('tocar el código lo amplía; "Cerrar" del pie lo cierra', async () => {
    show('ready');
    renderWithProviders(<MyQrPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ampliar código QR' }));
    const dialog = screen.getByRole('dialog', { name: 'Ana Ruiz' });
    expect(within(dialog).getByText('EMP-7')).toBeInTheDocument();
    const buttons = within(dialog).getAllByRole('button', { name: 'Cerrar' });
    await userEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('MyQrPage: nombre que se muestra', () => {
  it('sin datos de empleado: su correo', async () => {
    state.user = { ...sampleUser, employee: null };
    show('ready');
    renderWithProviders(<MyQrPage />);
    expect(screen.getByText('ana@empresa.com', { selector: 'strong' })).toBeInTheDocument();
    expect(await screen.findByAltText('Código QR de ana@empresa.com')).toBeInTheDocument();
  });

  it('sin sesión (al cerrarla) no se rompe: el código sin nombre', async () => {
    state.user = null;
    show('ready');
    renderWithProviders(<MyQrPage />);
    expect(await screen.findByAltText('Código QR de')).toBeInTheDocument();
  });
});
