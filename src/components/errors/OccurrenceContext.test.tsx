import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OccurrenceContext } from './OccurrenceContext';

describe('Contexto de una ocurrencia', () => {
  it('muestra quién, qué pidió y qué se le respondió (los secretos ya vienen ocultos)', () => {
    render(
      <OccurrenceContext
        context={{
          request: {
            method: 'POST',
            path: '/api/employees',
            query: { page: '1' },
            ip: '10.0.0.7',
            headers: { 'user-agent': 'iPhone' },
            body: { email: 'juan@empresa.com', password: '[oculto]' },
            body_bytes: 120,
            body_truncated: true,
          },
          response: { status: 409, body: { code: 'EMAIL_TAKEN' } },
          user: { id: 4, email: 'admin@empresa.com', role: 'COMPANY' },
          company_id: 2,
          duration_ms: 12.5,
        }}
      />,
    );
    expect(screen.getByText('POST /api/employees → 409 · 12.5 ms')).toBeInTheDocument();
    expect(screen.getByText('admin@empresa.com · COMPANY · Empresa #2 · IP 10.0.0.7')).toBeInTheDocument();
    expect(screen.getByText('Cuerpo de la petición (cortado) · 120 bytes')).toBeInTheDocument();
    expect(screen.getByText(/"password": "\[oculto\]"/)).toBeInTheDocument();
    expect(screen.getByText('Respuesta (409)')).toBeInTheDocument();
    expect(screen.getByText('Parámetros de la URL')).toBeInTheDocument();
  });

  it('sin sesión, sin cuerpo ni respuesta; cuenta sin correo ni rol', () => {
    const { rerender } = render(<OccurrenceContext context={{ request: { method: null, path: null }, user: null }} />);
    expect(screen.getByText('Sin sesión')).toBeInTheDocument();
    expect(screen.getByText('Cuerpo de la petición · 0 bytes')).toBeInTheDocument();
    expect(screen.queryByText(/Respuesta/)).toBeNull();
    rerender(<OccurrenceContext context={{ request: { method: 'GET', path: '/api/x' }, user: { id: 9, email: null, role: null } }} />);
    expect(screen.getByText('Cuenta #9 · sin rol')).toBeInTheDocument();
  });

  it('un error del log dice dónde se registró', () => {
    const { rerender } = render(<OccurrenceContext context={{ logger: 'app.services.x', thread: 'mantenimiento', function: 'purge' }} />);
    expect(screen.getByText('Registrado por app.services.x (purge)')).toBeInTheDocument();
    expect(screen.getByText('Dónde')).toBeInTheDocument();
    rerender(<OccurrenceContext context={{}} />);
    expect(screen.getByText('Registrado por el backend')).toBeInTheDocument();
  });
});
