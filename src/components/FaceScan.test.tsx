import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { currentStage, ScanCard, scanStages, ScanStagesPreview, stageFill } from './FaceScan';

describe('FaceScan: etapas del escáner facial', () => {
  it('cinco etapas con prueba de vida, cuatro sin ella', () => {
    expect(scanStages(true)).toEqual(['prepare', 'align', 'scan', 'liveness', 'confirm']);
    expect(scanStages(false)).toEqual(['prepare', 'align', 'scan', 'confirm']);
  });

  it('la etapa visible sigue a la fase del flujo y a la guía en vivo', () => {
    expect(currentStage('frontal', 'loading')).toBe('prepare');
    expect(currentStage('frontal', 'too_far')).toBe('prepare');
    expect(currentStage('frontal', 'off_center')).toBe('align');
    expect(currentStage('frontal', 'hold_still')).toBe('align');
    expect(currentStage('checking', 'ready')).toBe('scan');
    expect(currentStage('flash', 'ready')).toBe('liveness'); // destello de colores
    expect(currentStage('challenge', 'move')).toBe('liveness');
    expect(currentStage('submitting', 'ready')).toBe('confirm');
    expect(currentStage('blocked', 'ready')).toBe('align');
  });

  it('el segmento actual se llena con el avance de su etapa', () => {
    const base = { progress: 0.5, moveProgress: 0.25, capture: null };
    expect(stageFill('align', base)).toBe(0.5);
    expect(stageFill('scan', { ...base, capture: { current: 2, total: 4 } })).toBe(0.5);
    expect(stageFill('scan', base)).toBe(1); // capturas tomadas: se valida
    expect(stageFill('liveness', base)).toBe(0.25);
    expect(stageFill('confirm', base)).toBe(0.6); // esperando al servidor
    expect(stageFill('prepare', base)).toBeGreaterThan(0);
  });

  it('tarjeta: barra segmentada que cuenta las etapas, indicación, rótulo de la etapa y cancelar', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ScanCard
        title="Verificación facial"
        stages={scanStages(true)}
        stage="liveness"
        fill={0.5}
        intro={{ title: 'Sigue la indicación', text: 'Gira la cabeza hacia tu izquierda', label: 'Prueba de vida · paso 1 de 2' }}
        viewport={<p>visor</p>}
        actions={<button type="button">Identificarme con QR</button>}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Verificación facial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sigue la indicación' })).toBeInTheDocument();
    // El rótulo corto (lo único que se ve arriba en un teléfono; el CSS elige).
    expect(document.querySelector('.faceid__eyebrow')).toHaveTextContent('Prueba de vida · paso 1 de 2');
    // La barra es también el contador (sin repetirlo con números a la vista).
    const segments = within(screen.getByRole('list', { name: 'Etapa 4 de 5' })).getAllByRole('listitem');
    expect(segments.map((s) => s.className)).toEqual(['is-done', 'is-done', 'is-done', 'is-current', '']);
    expect(segments[3]).toHaveAttribute('aria-current', 'step');
    expect(segments[3].style.getPropertyValue('--fill')).toBe('0.5');
    expect(screen.getByText('Gira la cabeza hacia tu izquierda')).toBeInTheDocument();
    // Bajo la cámara no hay textos fijos (las instrucciones se dan al inicio y en la cámara).
    expect(document.querySelector('.faceid__stage, .requirements, .faceid__privacy')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalled();
    // Sin rótulo propio, el rótulo es el título.
    rerender(
      <ScanCard title="Verificación facial" stages={scanStages(false)} stage="align" fill={0} intro={{ title: 'Centra tu rostro', text: 'Mira a la cámara.' }} viewport={null} onCancel={onCancel} />,
    );
    expect(document.querySelector('.faceid__eyebrow')).toHaveTextContent('Centra tu rostro');
    expect(screen.getByRole('list', { name: 'Etapa 2 de 4' })).toBeInTheDocument();
  });

  it('la pantalla de inicio anuncia las mismas etapas que contará el escáner (n / N)', () => {
    const { rerender } = render(<ScanStagesPreview stages={scanStages(true)} />);
    const titles = () => within(screen.getByRole('list', { name: 'Etapas del escaneo' })).getAllByRole('listitem').map((li) => li.querySelector('strong')?.textContent);
    expect(titles()).toEqual(['1. Mira hacia la cámara', '2. Centra tu rostro', '3. Mantente quieto', '4. Sigue la indicación', '5. Confirmando tu identidad']);
    rerender(<ScanStagesPreview stages={scanStages(false)} />);
    expect(titles()).toHaveLength(4); // sin prueba de vida, igual que el escáner
  });
});
