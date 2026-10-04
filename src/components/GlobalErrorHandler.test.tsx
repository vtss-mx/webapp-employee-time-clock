import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { ApiError } from '../services/apiClient';
import { apiOk, mockFetch } from '../test/http';
import { GlobalErrorHandler } from './GlobalErrorHandler';

const GENERIC_TEXT = 'Intenta nuevamente. Si persiste, recarga la página.';

function rejectUnhandled(reason: unknown) {
  const event = new Event('unhandledrejection') as PromiseRejectionEvent;
  Object.defineProperty(event, 'reason', { value: reason });
  act(() => void window.dispatchEvent(event));
}

const scriptError = (init: ErrorEventInit) => act(() => void window.dispatchEvent(new ErrorEvent('error', init)));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  render(
    <FeedbackProvider>
      <GlobalErrorHandler />
    </FeedbackProvider>,
  );
});

describe('GlobalErrorHandler', () => {
  it('un error de la API no capturado se muestra con su mensaje; una ráfaga no abre más popups', async () => {
    rejectUnhandled(new ApiError({ statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Servicio ocupado', traceId: 't-9' }));
    const popup = await screen.findByRole('alertdialog', { name: 'Ocurrió un problema' });
    expect(popup).toHaveTextContent('Servicio ocupado');
    rejectUnhandled(new Error('Otra falla en menos de 4 s'));
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(popup).not.toHaveTextContent(GENERIC_TEXT);
    expect(screen.queryByText(/de 2/)).toBeNull(); // no quedó en cola
  });

  it('errores de scripts: avisa con un texto amable; los de recursos externos o ResizeObserver se ignoran', async () => {
    scriptError({ message: 'No se pudo cargar la imagen' }); // recurso externo: sin objeto de error
    scriptError({ message: 'ResizeObserver loop completed with undelivered notifications.', error: new Error('ResizeObserver') });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    scriptError({ message: 'x is not a function', error: new TypeError('x is not a function') });
    const popup = await screen.findByRole('alertdialog', { name: 'Ocurrió un problema' });
    expect(popup).toHaveTextContent(GENERIC_TEXT);
    expect(popup).not.toHaveTextContent('x is not a function'); // el detalle técnico no se muestra
  });

  it('una falla de la app se reporta al ADMIN; una respuesta de la API no (el servidor ya la registró)', async () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    const reported = () => calls.filter((call) => call.url === '/api/client-errors').map((call) => JSON.parse(call.init.body as string) as Record<string, unknown>);
    rejectUnhandled(new ApiError({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'falló', traceId: 't-1' }));
    rejectUnhandled(new DOMException('Cancelada', 'AbortError')); // ni aviso ni reporte
    rejectUnhandled(new TypeError('promesa rota'));
    scriptError({ message: 'Uncaught RangeError', error: new RangeError('fuera de rango') });
    await waitFor(() => expect(reported()).toHaveLength(2));
    expect(reported().map((report) => [report.kind, report.component, report.message])).toEqual([
      ['UNHANDLED', 'unhandledrejection', 'TypeError: promesa rota'],
      ['UNHANDLED', 'window.onerror', 'RangeError: fuera de rango'],
    ]);
  });
});

