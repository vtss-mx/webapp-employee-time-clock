import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { apiFail, apiOk, mockFetch, type MockCall } from '../../test/http';
import { renderWithProviders } from '../../test/render';
import type { FaceSecurityOverview } from '../../types/faceSecurity';
import { FaceSecurityPage } from './FaceSecurityPage';

const overview: FaceSecurityOverview = {
  autocalibration: true,
  window_days: 30,
  min_samples: 300,
  interval_hours: 6,
  thresholds: [
    { key: 'LIVENESS_YAW', name: 'Giro mínimo de la cabeza', value: 0.21, floor: 0.18, cap: 0.28, samples: 420, computed_at: '2026-10-04T12:00:00Z', raised: true },
    { key: 'LIVENESS_CLOSER', name: 'Acercamiento mínimo a la cámara', value: 1.25, floor: 1.25, cap: 1.45, samples: 1, computed_at: null, raised: false },
    { key: 'FLASH_SCORE', name: 'Respuesta mínima al destello de colores', value: 0.35, floor: 0.35, cap: 0.75, samples: 0, computed_at: null, raised: false },
  ],
  escalation_min_attacks: 5,
  escalation_window_minutes: 30,
  reinforced: [{ company_id: 4, name: 'Panificadora', attacks: 7 }],
  flash: { measured: 120, conclusive: 100, inconclusive: 20, score_median: 0.62, score_p10: 0.3, magnitude_median: 0.012 },
};

/** Con todo lo necesario para exigir el destello y sin empresas bajo ataque. */
const calm: FaceSecurityOverview = {
  ...overview,
  autocalibration: false,
  reinforced: [],
  flash: { measured: 900, conclusive: 880, inconclusive: 20, score_median: 0.7, score_p10: 0.5, magnitude_median: 0.02 },
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/face-security" element={<FaceSecurityPage />} />
      <Route path="/admin/companies/:id" element={<p>Detalle de empresa</p>} />
    </Routes>,
    { route: '/admin/face-security' },
  );
}

const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement;

describe('FaceSecurityPage (seguridad facial de la plataforma)', () => {
  it('muestra los umbrales frente a su mínimo y su tope, las empresas reforzadas y lo medido del destello', async () => {
    const { calls } = mockFetch(apiOk(overview));
    const { container } = renderPage();
    expect(screen.getByLabelText('Cargando')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recalcular ahora' })).toBeDisabled(); // sin datos aún
    await screen.findByText('Giro mínimo de la cabeza');
    expect(calls[0].url).toBe('/api/admin/face-security');

    expect([...container.querySelectorAll('.kpi__label')].map((kpi) => kpi.textContent)).toEqual(['Umbrales endurecidos', 'Empresas reforzadas', 'Destellos medidos', 'Destellos concluyentes']);
    await waitFor(() => expect(container.querySelectorAll('.kpi__value')[2]).toHaveTextContent('120'));
    expect(screen.getByText(/Cada 6 h la plataforma mide los intentos exitosos de los últimos 30 días/)).toBeInTheDocument();

    const yaw = card('Giro mínimo de la cabeza');
    expect(yaw).toHaveTextContent('Endurecido por la plataforma');
    expect(yaw).toHaveTextContent('0.21');
    expect(yaw).toHaveTextContent(/420 intentos medidos · calculado /);
    const meter = within(yaw).getByRole('meter', { name: 'Giro mínimo de la cabeza: 0.21' });
    expect(meter).toHaveAttribute('aria-valuemin', '0.18');
    expect(meter).toHaveAttribute('aria-valuemax', '0.28');
    expect(meter.style.getPropertyValue('--meter')).toBe(String((0.21 - 0.18) / (0.28 - 0.18)));
    const closer = card('Acercamiento mínimo a la cámara');
    expect(closer).toHaveTextContent('En el mínimo');
    expect(closer).toHaveTextContent('×1.25');
    expect(closer).toHaveTextContent('1 intento medido · aún sin calcular');
    expect(closer).toHaveTextContent('Mínimo ×1.25Tope ×1.45');

    expect(screen.getByText(/Con 5 intentos sospechosos en 30 min/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Panificadora/ })).toHaveTextContent('7 intentos');

    const flash = screen.getByRole('heading', { name: 'Destello de colores' }).closest('section') as HTMLElement;
    expect(within(flash).getByText('Calibrando')).toBeInTheDocument();
    expect(within(flash).getByText('Respuesta del 10 % más bajo').nextSibling).toHaveTextContent('0.3');
    expect(within(flash).getByText('Intensidad mediana').nextSibling).toHaveTextContent('0.012');
    expect(within(flash).getByText('Aún no conviene exigirlo')).toBeInTheDocument();
    expect(within(flash).getByText('Reunir 300 mediciones concluyentes (van 100).')).toBeInTheDocument();
    expect(within(flash).getByText('Que el 10 % con menor respuesta supere 0.35 (hoy 0.3).')).toBeInTheDocument();
    expect(within(flash).getByText('Menos mediciones con demasiada luz: hoy 17 % (máximo 10 %).')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: /Panificadora/ }));
    expect(await screen.findByText('Detalle de empresa')).toBeInTheDocument();
  });

  it('sin empresas bajo ataque lo celebra; con el destello calibrado dice que ya se puede exigir', async () => {
    mockFetch(apiOk(calm));
    renderPage();
    expect(await screen.findByText('Ninguna empresa bajo ataque')).toBeInTheDocument();
    expect(document.querySelector('.empty-state--success')).not.toBeNull();
    expect(screen.getByText('Listo para exigirlo')).toBeInTheDocument();
    expect(screen.getByText('Ya se puede exigir el destello')).toBeInTheDocument();
    expect(screen.getByText(/La autocalibración está apagada/)).toBeInTheDocument();
  });

  it('"Recalcular ahora" pregunta antes; cancelar no envía nada; al confirmar avisa cuántos cambiaron y muestra los nuevos', async () => {
    const raised = { ...overview, thresholds: overview.thresholds.map((t) => (t.key === 'LIVENESS_CLOSER' ? { ...t, value: 1.31, raised: true } : t)) };
    const { calls } = mockFetch((call: MockCall) =>
      call.url.endsWith('/recalibrate') ? apiOk(raised, { code: 'THRESHOLDS_RECALIBRATED', message: 'Umbrales recalculados (1 cambiaron)' }) : apiOk(overview),
    );
    renderPage();
    await screen.findByText('Giro mínimo de la cabeza');
    await userEvent.click(screen.getByRole('button', { name: 'Recalcular ahora' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Recalcular ahora los umbrales?' });
    expect(dialog).toHaveTextContent('Se recalculan con los intentos exitosos de los últimos 30 días, lo mismo que hace la plataforma cada 6 h.');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Ventana30 díasMediciones para mover un umbral300');
    expect(dialog).toHaveTextContent('Solo endurece');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.url.endsWith('/recalibrate'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Recalcular ahora' }));
    dialog = await screen.findByRole('dialog', { name: '¿Recalcular ahora los umbrales?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Recalcular ahora' }));
    expect(await screen.findByText('Umbrales recalculados (1 cambiaron)')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/recalibrate'))?.init.method).toBe('POST');
    expect(card('Acercamiento mínimo a la cámara')).toHaveTextContent('×1.31');
    expect(card('Acercamiento mínimo a la cámara')).toHaveTextContent('Endurecido por la plataforma');
  });

  it('si recalcular falla lo explica; si la pantalla no carga ofrece volver a cargar', async () => {
    let loads = 0;
    mockFetch((call: MockCall) => {
      if (call.url.endsWith('/recalibrate')) return apiFail(500, 'INTERNAL_ERROR', 'Falla del servidor');
      return loads++ === 0 ? apiFail(403, 'FORBIDDEN', 'Sin permiso') : apiOk(overview);
    });
    renderPage();
    const failed = await screen.findByRole('alertdialog', { name: 'No se pudo cargar la seguridad facial' });
    await userEvent.click(within(failed).getAllByRole('button', { name: 'Cerrar' })[0]);
    await userEvent.click(await screen.findByRole('button', { name: 'Volver a cargar' }));
    await screen.findByText('Giro mínimo de la cabeza');

    await userEvent.click(screen.getByRole('button', { name: 'Recalcular ahora' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Recalcular ahora los umbrales?' })).getByRole('button', { name: 'Recalcular ahora' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudieron recalcular los umbrales' })).toBeInTheDocument();
    expect(card('Giro mínimo de la cabeza')).toHaveTextContent('0.21'); // sin cambios
  });
});
