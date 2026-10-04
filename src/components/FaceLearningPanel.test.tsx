import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch } from '../test/http';
import { renderWithProviders } from '../test/render';
import type { FaceLearningSummary } from '../types';
import { FaceLearningPanel } from './FaceLearningPanel';

const summary: FaceLearningSummary = {
  enabled: true,
  approved_employees: 40,
  employees_learning: 12,
  learned_samples: 30,
  identifications: 400,
  learned_identifications: 90,
  last_learned_at: '2026-10-01T10:00:00Z',
};

describe('FaceLearningPanel (tablero de la empresa)', () => {
  it('muestra cómo evoluciona el reconocimiento', async () => {
    const { calls } = mockFetch(apiOk(summary));
    renderWithProviders(<FaceLearningPanel />);
    expect(await screen.findByText('Aprendiendo')).toBeInTheDocument();
    expect(screen.getByText('Identificaciones resueltas por lo aprendido')).toBeInTheDocument();
    expect(screen.getByText(/12 de 40 empleados con rostro aprobado/)).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/employees/face/learning');
  });

  it('sin aprendizajes todavía y en pausa: invita a activarlo en Configuración', async () => {
    mockFetch(apiOk({ ...summary, enabled: false, employees_learning: 0, learned_samples: 0, learned_identifications: 0, last_learned_at: null }));
    renderWithProviders(<FaceLearningPanel />);
    expect(await screen.findByText('En pausa')).toBeInTheDocument();
    expect(screen.getByText(/Aún no aprende/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Activar' })).toHaveAttribute('href', '/company/settings');
  });

  it('si no carga ofrece reintentar', async () => {
    mockFetch(apiFail(500, 'INTERNAL_ERROR'), apiOk(summary));
    renderWithProviders(<FaceLearningPanel />);
    const [retry] = await screen.findAllByRole('button', { name: /Reintentar/ });
    await userEvent.click(retry);
    expect(await screen.findByText('Aprendiendo')).toBeInTheDocument();
  });
});
