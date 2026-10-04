import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { WithCatalogs } from '../test/render';
import { AccessoryAlert, FaceGuide, guidanceTone, QrGuide } from './FaceGuide';

const progressRing = (container: HTMLElement) => container.querySelector<SVGPathElement>('.face-scan__progress');

describe('FaceGuide: visor del escáner facial', () => {
  it('el tono sigue a la guía: listo en verde, sin rostro neutro y cualquier problema como advertencia', () => {
    const tones = (list: FaceGuidance[]) => list.map(guidanceTone);
    expect(tones(['hold_still', 'ready'])).toEqual(['ok', 'ok']);
    expect(tones(['no_face', 'loading'])).toEqual(['idle', 'idle']);
    expect(tones(['multiple', 'too_far', 'too_close', 'off_center', 'look_straight', 'too_dark', 'too_bright', 'turn'])).toEqual(Array(8).fill('warn'));
  });

  it('el anillo se llena con el avance y el mensaje se anuncia a lectores de pantalla', () => {
    const { container, rerender } = render(<FaceGuide tone="ok" message="Rostro detectado. Mantente quieto..." progress={0.42} stage="align" />);
    expect(progressRing(container)?.style.strokeDashoffset).toBe('58');
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--ok', 'face-scan--align');
    expect(screen.getByRole('status')).toHaveTextContent('Rostro detectado. Mantente quieto...');
    expect(screen.getByRole('status').querySelector('.lucide-shield-check')).not.toBeNull();

    rerender(<FaceGuide tone="busy" message="Analizando..." />);
    expect(progressRing(container)?.style.strokeDashoffset).toBe('0'); // procesando: anillo completo
    expect(container.querySelector('.face-scan')?.className).not.toMatch(/undefined/);
    expect(screen.getByRole('status').querySelector('.lucide-scan-face')).not.toBeNull();

    rerender(<FaceGuide tone="idle" message="Coloca tu rostro frente a la cámara" />);
    expect(progressRing(container)?.style.strokeDashoffset).toBe('100');
  });

  it('accesorios a retirar con su nombre del catálogo; sin accesorios no se muestra nada', () => {
    const { container, rerender } = render(<AccessoryAlert items={[]} />, { wrapper: WithCatalogs });
    expect(container).toBeEmptyDOMElement();
    rerender(<AccessoryAlert items={['GLASSES', 'HEADWEAR']} />);
    expect(container.querySelector('.accessory-alert')).toHaveTextContent('LentesGorra');
    expect(container.querySelectorAll('.accessory-alert svg')).toHaveLength(2);
  });

  it('visor del QR: neutro por omisión y con el tono del momento', () => {
    const { container, rerender } = render(<QrGuide message="Apunta la cámara al código QR" />);
    expect(container.querySelector('.qr-guide')).toHaveClass('qr-guide--idle');
    expect(screen.getByRole('status')).toHaveTextContent('Apunta la cámara al código QR');
    rerender(<QrGuide message="QR inválido" tone="warn" />);
    expect(container.querySelector('.qr-guide')).toHaveClass('qr-guide--warn');
    expect(screen.getByRole('status')).toHaveClass('camera__message--warn');
  });
});
