import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../i18n/core';
import { apiOk, mockFetch, type MockCall } from '../test/http';
import { ErrorBoundary } from './ErrorBoundary';

const reports = (calls: MockCall[]) => calls.filter((call) => call.url === '/api/client-errors').map((call) => JSON.parse(call.init.body as string) as Record<string, unknown>);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('ErrorBoundary: reporte de la falla', () => {
  it('una pantalla rota se reporta al ADMIN con el componente que falló y su pila (sin otro aviso)', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    function Bomb(): never {
      throw new RangeError('índice fuera de rango');
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Error en esta pantalla');
    const [report] = reports(calls);
    expect(report).toMatchObject({ kind: 'CRASH', message: 'RangeError: índice fuera de rango', component: 'Bomb', path: '/' });
    expect(report.detail).toContain('Bomb');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('sin pila de componentes (o sin marcos legibles) se reporta igual', () => {
    const { calls } = mockFetch(apiOk(null, { status: 202 }));
    const boundary = new ErrorBoundary({ children: null });
    boundary.componentDidCatch(new Error('sin pila'), { componentStack: null });
    boundary.componentDidCatch(new Error('sin marcos'), { componentStack: 'sin marcos legibles' });
    expect(reports(calls).map((report) => [report.message, report.component, report.detail])).toEqual([
      ['Error: sin pila', null, null],
      ['Error: sin marcos', null, 'sin marcos legibles'],
    ]);
  });
});

describe('ErrorBoundary en inglés (en-US)', () => {
  it('la pantalla de la falla en inglés', async () => {
    mockFetch(apiOk(null, { status: 202 }));
    await setLocale('en-US');
    function Bomb(): never {
      throw new Error('falla');
    }
    render(
      <ErrorBoundary inline>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: 'This screen ran into an error' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to home' })).toBeInTheDocument();
  });
});
