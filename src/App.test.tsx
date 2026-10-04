import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { apiOk, mockFetch } from './test/http';

describe('App', () => {
  it('sin sesión, la raíz lleva al inicio de sesión con todos los proveedores montados', async () => {
    const { calls } = mockFetch(apiOk(null));
    window.history.replaceState(null, '', '/');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    // Anónimo: no se piden catálogos ni datos de la sesión.
    expect(calls.some((call) => call.url.includes('/catalogs'))).toBe(false);
  });
});
