import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { setLocale } from '../i18n/core';
import { WithCatalogs } from '../test/render';
import { AccessoryAlert, FaceGuide, guidanceTone, QrGuide } from './FaceGuide';

describe('FaceGuide: visor del escáner facial', () => {
  it('el tono sigue a la guía: listo en verde, sin rostro neutro y cualquier problema como advertencia', () => {
    const tones = (list: FaceGuidance[]) => list.map(guidanceTone);
    expect(tones(['hold_still', 'ready'])).toEqual(['ok', 'ok']);
    expect(tones(['no_face', 'loading'])).toEqual(['idle', 'idle']);
    expect(tones(['multiple', 'too_far', 'too_close', 'off_center', 'look_straight', 'too_dark', 'too_bright', 'move'])).toEqual(Array(8).fill('warn'));
  });

  it('círculo con la silueta (verde al estar bien colocado), anillo continuo que avanza con las fotos y UNA indicación en vivo', () => {
    const { container, rerender } = render(<FaceGuide tone="ok" message="Mantente quieto" progress={0.42} stage="align" />);
    const scan = container.querySelector('.face-scan');
    expect(scan).toHaveClass('face-scan', 'face-scan--ok', 'face-scan--align');
    expect(scan).not.toHaveClass('face-scan--complete');
    expect(scan).not.toHaveClass('face-scan--flash');
    expect(container.querySelectorAll('.face-scan__silhouette path')).toHaveLength(2);
    // El avance es continuo (sin marcas): el anillo lo dice a lectores de pantalla.
    const ring = screen.getByRole('img', { name: 'Captura al 42 %' });
    expect(ring).toHaveAttribute('data-value', '42');
    expect(ring).not.toHaveClass('progress-ring--active');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Mantente quieto');
    expect(status).toHaveClass('camera__message--face', 'camera__message--ok');
    expect(status.querySelector('.camera__detail')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Captura completa' })).toBeNull();

    // Mientras se toman las fotos: la luz en la punta del anillo y la cuenta bajo la indicación (sin anunciarla).
    rerender(<FaceGuide tone="busy" message="Mantente quieto" detail="Foto 12 de 36" progress={0.3} stage="scan" capturing />);
    expect(screen.getByRole('img', { name: 'Captura al 30 %' })).toHaveClass('progress-ring--active');
    expect(screen.getByText('Foto 12 de 36')).toHaveAttribute('aria-hidden', 'true');

    // El destello: alrededor del círculo, el fondo neutro.
    rerender(<FaceGuide tone="busy" message="Mantén tu rostro frente a la pantalla" progress={0.75} stage="liveness" flash />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--flash', 'face-scan--liveness');

    rerender(<FaceGuide tone="busy" message={() => 'Confirmando tu identidad…'} progress={0.5} capturing complete />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--complete');
    expect(container.querySelector('.face-scan')?.className).not.toMatch(/undefined|false/);
    const full = screen.getByRole('img', { name: 'Captura al 100 %' }); // completo con la marca ✓ (ya sin la luz)
    expect(full).toHaveAttribute('data-value', '100');
    expect(full).not.toHaveClass('progress-ring--active');
    expect(screen.getByRole('img', { name: 'Captura completa' }).querySelector('.lucide-check')).not.toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando tu identidad…');

    rerender(<FaceGuide tone="idle" message="Coloca tu rostro dentro de la silueta" />);
    expect(screen.getByRole('img', { name: 'Captura al 0 %' })).toHaveAttribute('data-value', '0');
  });

  it('en inglés: el anillo y la marca de captura completa', async () => {
    await setLocale('en-US');
    render(<FaceGuide tone="busy" message="Confirming your identity…" complete />);
    expect(screen.getByRole('img', { name: 'Capture 100% complete' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Capture complete' })).toBeInTheDocument();
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
