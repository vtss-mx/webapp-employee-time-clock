import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../context/FeedbackContext';
import { useErrorPopup, useFeedback } from '../hooks/useFeedback';
import { ApiError, MOBILE_DEVICE_REQUIRED } from '../services/apiClient';
import { describeError, isHandledGlobally } from '../utils/errorPresentation';
import { lockScroll } from '../utils/scrollLock';
import { cameraProblemMessage } from './cameraMessages';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
const setup = () => renderHook(() => useFeedback(), { wrapper }).result;

const apiError = (statusCode: number, code: string, message: string, extra: object = {}) =>
  new ApiError({ statusCode, code, message, traceId: 'trace-123', ...extra });

describe('describeError', () => {
  it('título y tono según el tipo de error; rastreo solo en fallas de servidor o red', () => {
    expect(describeError(apiError(0, 'NETWORK_ERROR', 'Sin red'))).toMatchObject({ variant: 'error', title: 'Sin conexión con el servidor', traceId: 'trace-123', retryable: true });
    expect(describeError(apiError(500, 'INTERNAL_ERROR', 'Falló'))).toMatchObject({ variant: 'error', title: 'Ocurrió un problema en el servidor', traceId: 'trace-123' });
    expect(describeError(apiError(409, 'RFC_TAKEN', 'RFC en uso'))).toMatchObject({ variant: 'warning', title: 'La información ya existe', traceId: null });
    expect(describeError(apiError(418, 'TEAPOT', 'x')).title).toBe('No se pudo completar la operación');
    expect(describeError(apiError(409, 'X', 'x'), 'No se pudo guardar').title).toBe('No se pudo guardar');
  });

  it('agrega los errores por campo sin repetir el mensaje principal', () => {
    const errors = [
      { code: 'a', message: 'Datos inválidos', field: 'x', details: null },
      { code: 'b', message: 'El RFC es obligatorio', field: 'rfc', details: null },
      { code: 'c', message: 'El RFC es obligatorio', field: 'rfc2', details: null },
    ];
    expect(describeError(apiError(422, 'VALIDATION_ERROR', 'Datos inválidos', { errors })).details).toEqual(['El RFC es obligatorio']);
  });

  it('errores que no vienen de la API', () => {
    expect(describeError(new Error('boom'))).toMatchObject({ variant: 'error', title: 'Ocurrió un problema', text: 'boom' });
    expect(describeError('texto').text).toBe('texto');
    expect(describeError(null).text).toMatch(/inesperado/);
  });

  it('dispositivo no permitido y sesión vencida se presentan de forma global', () => {
    expect(isHandledGlobally(apiError(403, MOBILE_DEVICE_REQUIRED, 'x'))).toBe(true);
    expect(isHandledGlobally(apiError(401, 'TOKEN_EXPIRED', 'x'))).toBe(true);
    expect(isHandledGlobally(apiError(401, 'INVALID_CREDENTIALS', 'x'), { showAuthErrors: true })).toBe(false);
    expect(isHandledGlobally(new Error('x'))).toBe(false);
  });
});

describe('popup de mensajes', () => {
  it('muestra el mensaje y se resuelve con la acción elegida', async () => {
    const feedback = setup();
    let choice: Promise<string | null> = Promise.resolve(null);
    act(() => {
      choice = feedback.current.show({
        variant: 'warning',
        title: 'Revisa la información',
        text: 'Corrige los campos',
        details: ['Falta el RFC'],
        actions: [
          { id: 'no', label: 'Ahora no' },
          { id: 'yes', label: 'Continuar' },
        ],
      });
    });
    const popup = screen.getByRole('alertdialog', { name: 'Revisa la información' });
    expect(popup).toHaveAccessibleDescription('Corrige los campos');
    expect(within(popup).getByText('Atención')).toBeInTheDocument();
    expect(within(popup).getByText('Falta el RFC')).toBeInTheDocument();
    expect(within(popup).getByRole('button', { name: 'Continuar' })).toHaveFocus(); // acción principal
    await userEvent.click(within(popup).getByRole('button', { name: 'Continuar' }));
    await expect(choice).resolves.toBe('yes');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cola sin duplicados: uno a la vez con contador', async () => {
    const feedback = setup();
    act(() => {
      void feedback.current.error('Primero');
      void feedback.current.info('Segundo');
      void feedback.current.info('Segundo'); // duplicado: no se agrega
    });
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.getByRole('dialog', { name: 'Segundo' })).toBeInTheDocument();
    expect(screen.queryByText(/de 2/)).toBeNull();
    act(() => feedback.current.dismiss('info|Segundo|'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape y la X cierran; un mensaje obligatorio solo se cierra con su acción', async () => {
    const feedback = setup();
    let closed: Promise<string | null> = Promise.resolve('x');
    act(() => {
      closed = feedback.current.info('Aviso');
    });
    await userEvent.keyboard('{Escape}');
    await expect(closed).resolves.toBeNull();

    act(() => {
      void feedback.current.show({ variant: 'info', title: 'Obligatorio', dismissible: false, actions: [{ id: 'ok', label: 'Aceptar' }] });
    });
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Obligatorio' })).toBeInTheDocument();
  });

  it('el foco no sale del popup (Tab y Shift+Tab)', async () => {
    const feedback = setup();
    act(() => {
      void feedback.current.show({ variant: 'error', title: 'Foco', actions: [{ id: 'a', label: 'Uno' }, { id: 'b', label: 'Dos' }] });
    });
    const close = screen.getByRole('button', { name: 'Cerrar' });
    const last = screen.getByRole('button', { name: 'Dos' });
    expect(last).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it('desde un error: código de rastreo copiable y "Reintentar"', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const retry = vi.fn();
    const feedback = setup();
    act(() => {
      void feedback.current.fromError(apiError(500, 'INTERNAL_ERROR', 'Falló'), { title: 'No se pudo cargar', retry });
    });
    const popup = screen.getByRole('alertdialog', { name: 'No se pudo cargar' });
    expect(within(popup).getByText('trace-123')).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Copiar código de rastreo' }));
    expect(writeText).toHaveBeenCalledWith('trace-123');
    expect(await within(popup).findByText('Copiado')).toBeInTheDocument();
    await userEvent.click(within(popup).getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(retry).toHaveBeenCalledOnce());
  });

  it('no repite los avisos globales (dispositivo, sesión) salvo en el login', async () => {
    const feedback = setup();
    await act(async () => {
      await expect(feedback.current.fromError(apiError(403, MOBILE_DEVICE_REQUIRED, 'x'))).resolves.toBeNull();
      await expect(feedback.current.fromError(apiError(401, 'TOKEN_EXPIRED', 'x'))).resolves.toBeNull();
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    act(() => {
      void feedback.current.fromError(apiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos'), { showAuthErrors: true });
    });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Correo o contraseña incorrectos');
  });

  it('formulario inválido: resumen de los campos', () => {
    const feedback = setup();
    act(() => {
      void feedback.current.invalidForm({ email: 'Correo inválido', password: undefined, rfc: 'Falta el RFC' });
    });
    const popup = screen.getByRole('alertdialog', { name: 'Revisa la información' });
    expect(within(popup).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Correo inválido', 'Falta el RFC']);
  });

  it('useErrorPopup abre el popup cuando aparece un error de carga', async () => {
    function Page() {
      const [error, setError] = useState<unknown>(null);
      useErrorPopup(error, { title: 'No se pudo cargar' });
      return <button onClick={() => setError(apiError(503, 'SERVER_BUSY', 'Ocupado'))}>cargar</button>;
    }
    render(<Page />, { wrapper });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.click(screen.getByText('cargar'));
    expect(screen.getByRole('alertdialog', { name: 'No se pudo cargar' })).toHaveTextContent('Ocupado');
  });
});

describe('lockScroll', () => {
  it('solo desbloquea cuando se libera el último bloqueo', () => {
    const a = lockScroll();
    const b = lockScroll();
    a();
    a(); // liberar dos veces no cuenta doble
    expect(document.body).toHaveClass('no-scroll');
    b();
    expect(document.body).not.toHaveClass('no-scroll');
  });
});

describe('mensajes de la cámara', () => {
  it('fallas: tono según la causa y versión segura cuando aplica', () => {
    const insecure = cameraProblemMessage({ kind: 'insecure', title: 't', message: 'm', steps: ['a'], secureUrl: 'https://x' });
    expect(insecure.variant).toBe('warning');
    expect(insecure.actions?.map((a) => a.id)).toEqual(['retry', 'secure']);
    const busy = cameraProblemMessage({ kind: 'busy', title: 't', message: 'm', steps: [] });
    expect(busy.variant).toBe('error');
    expect(busy.actions?.map((a) => a.id)).toEqual(['close', 'retry']);
  });
});
