import { act, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useFeedback } from '../hooks/useFeedback';
import { FeedbackProvider } from './FeedbackContext';

const Providers = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

describe('FeedbackProvider: cola de popups', () => {
  it('un doble clic en la acción la resuelve una sola vez y no cierra el mensaje siguiente', async () => {
    const feedback = renderHook(() => useFeedback(), { wrapper: Providers }).result;
    let first: Promise<string | null> = Promise.resolve(null);
    act(() => {
      first = feedback.current.show({ variant: 'info', title: 'Primero', actions: [{ id: 'ok', label: 'Aceptar' }] });
      void feedback.current.info('Segundo');
    });
    const accept = screen.getByRole('button', { name: 'Aceptar' });
    // Ambos clics llegan antes de que el popup se vuelva a dibujar.
    act(() => {
      accept.click();
      accept.click();
    });
    await expect(first).resolves.toBe('ok');
    expect(screen.getByRole('dialog', { name: 'Segundo' })).toBeInTheDocument();
    // Quitar un aviso que ya no está en la cola no afecta al que se muestra.
    act(() => feedback.current.dismiss('info|Primero|'));
    expect(screen.getByRole('dialog', { name: 'Segundo' })).toBeInTheDocument();
  });
});
