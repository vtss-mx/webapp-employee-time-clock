import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale, t } from '../i18n';
import { CHECK_OK, flow, renderFlow, resetFaceFlow, stable, TWO_TURNS } from '../test/faceFlow';
import { apiFail, apiOk, mockFetch } from '../test/http';

vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const id = TWO_TURNS.challenge_id!;
const metadata = {
  id, execution_status: 'READY', decision_status: null, attempt_id: null, device_nonce: null,
  created_at: '2026-10-10T22:00:00Z', expires_at: '2026-10-10T22:01:00Z',
  policy_version: 'p'.repeat(64), flow_version: 'test-protocol',
};

function server(status = 'READY', cancelFails = false) {
  return mockFetch((call) => {
    if (call.url.includes('/face/challenge')) return apiOk(TWO_TURNS);
    if (call.url.includes('/face/check')) return apiOk(CHECK_OK);
    if (call.url.endsWith('/cancel')) return cancelFails ? apiFail(503, 'SESSION_CANCEL_FAILED') : apiOk({ ...metadata, execution_status: 'CANCELLED' });
    return apiOk({ ...metadata, execution_status: status, ...(status === 'COMPLETED' ? { decision_status: 'APPROVED', attempt_id: 7 } : {}) });
  });
}

const settle = () => act(() => vi.advanceTimersByTimeAsync(0));
beforeEach(resetFaceFlow);
afterEach(async () => { vi.useRealTimers(); await setLocale('es-MX'); });

describe('LiveFaceFlow: sesión durable del servidor', () => {
  it('confirmación real en los siete idiomas, declinar conserva captura y confirmar cancela antes de cerrar', async () => {
    const { calls } = server();
    const onCancel = vi.fn();
    renderFlow({ onCancel });
    await stable();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await settle();
    for (const locale of LOCALES) {
      await act(async () => { await setLocale(locale); });
      const dialog = screen.getByRole('alertdialog', { name: t('face.session.cancelTitle') });
      expect(dialog).toHaveTextContent(t('face.session.cancelMessage'));
      expect(within(dialog).getByRole('button', { name: t('face.session.continue') })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: t('face.session.continue') }));
    await settle();
    expect(onCancel).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.url.includes('/verification/sessions/'))).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: t('common.actions.cancel') }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: t('face.session.cancelConfirm') }));
    await settle();
    expect(calls.filter((call) => call.url.includes('/verification/sessions/')).map((call) => call.init.method ?? 'GET')).toEqual(['GET', 'POST']);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(flow.onSubmit).not.toHaveBeenCalled();
  });

  it('una falla al cancelar conserva el flujo y entrega el error original a la pantalla', async () => {
    server('READY', true);
    const onCancel = vi.fn();
    renderFlow({ onCancel });
    await stable();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar captura' }));
    await settle();
    expect(onCancel).not.toHaveBeenCalled();
    expect(flow.onFatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_CANCEL_FAILED' }));
  });

  it.each(['CANCELLED', 'EXPIRED', 'COMPLETED'])('metadata %s impide enviar capturas y no concede APPROVED', async (status) => {
    const { calls } = server(status);
    renderFlow();
    await stable(); await stable(); await stable(); await stable();
    expect(calls.some((call) => call.url === `/api/verification/sessions/${id}`)).toBe(true);
    expect(flow.onSubmit).not.toHaveBeenCalled();
    if (status === 'COMPLETED') expect(flow.onFatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'VERIFICATION_SESSION_UNAVAILABLE' }));
    else expect(screen.getByText(t('face.session.noLongerActive'))).toBeInTheDocument();
  });

  it('cambiar a una alternativa cancela la sesión antes de abrir la otra forma de identificación', async () => {
    const { calls } = server();
    const onSelect = vi.fn();
    renderFlow({ alternative: { label: 'Usar QR', icon: null, onSelect } });
    await stable();
    fireEvent.click(screen.getByRole('button', { name: 'Usar QR' }));
    await settle();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar captura' }));
    await settle();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(calls.some((call) => call.url.endsWith('/cancel'))).toBe(true);
  });
});
