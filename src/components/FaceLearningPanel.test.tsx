import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n/core';
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

describe('FaceLearningPanel (consola del ADMIN: política de una empresa)', () => {
  it('muestra cómo evoluciona el reconocimiento', async () => {
    const { calls } = mockFetch(apiOk(summary));
    renderWithProviders(<FaceLearningPanel companyId={4} enabled />);
    expect(await screen.findByText('Aprendiendo')).toBeInTheDocument();
    expect(screen.getByText('Identificaciones resueltas por lo aprendido')).toBeInTheDocument();
    expect(screen.getByText(/12 de 40 empleados con rostro aprobado/)).toBeInTheDocument();
    expect(calls[0].url).toBe('/api/admin/companies/4/face-learning');
  });

  it('sin aprendizajes todavía y en pausa: dice dónde activarlo (en esta misma política)', async () => {
    mockFetch(apiOk({ ...summary, enabled: false, employees_learning: 0, learned_samples: 0, learned_identifications: 0, last_learned_at: null }));
    renderWithProviders(<FaceLearningPanel companyId={4} enabled={false} />);
    expect(await screen.findByText('En pausa')).toBeInTheDocument();
    expect(screen.getByText(/Aún no aprende/)).toBeInTheDocument();
    expect(screen.getByText(/Activa «Aprendizaje continuo» en esta política/)).toBeInTheDocument();
  });

  it('al cambiar el interruptor de la política vuelve a pedir el resumen', async () => {
    const { calls } = mockFetch(apiOk(summary), apiOk({ ...summary, enabled: false }));
    function Policy() {
      const [enabled, setEnabled] = useState(true);
      return (
        <>
          <button onClick={() => setEnabled(false)}>Pausar</button>
          <FaceLearningPanel companyId={4} enabled={enabled} />
        </>
      );
    }
    renderWithProviders(<Policy />);
    expect(await screen.findByText('Aprendiendo')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(await screen.findByText('En pausa')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('si no carga ofrece reintentar', async () => {
    mockFetch(apiFail(500, 'INTERNAL_ERROR'), apiOk(summary));
    renderWithProviders(<FaceLearningPanel companyId={4} enabled />);
    const [retry] = await screen.findAllByRole('button', { name: /Reintentar/ });
    await userEvent.click(retry);
    expect(await screen.findByText('Aprendiendo')).toBeInTheDocument();
  });
});

describe('FaceLearningPanel en inglés (en-US)', () => {
  it('la evolución del reconocimiento y la pausa, en inglés', async () => {
    await setLocale('en-US');
    mockFetch(apiOk({ ...summary, enabled: false }));
    renderWithProviders(<FaceLearningPanel companyId={4} enabled={false} />);
    expect(await screen.findByText('Paused')).toBeInTheDocument();
    expect(screen.getByText('Evolving face recognition')).toBeInTheDocument();
    expect(screen.getByText(/12 of 40 employees with an approved face/)).toBeInTheDocument();
    expect(screen.getByText('Continuous learning is paused')).toBeInTheDocument();
  });
});
