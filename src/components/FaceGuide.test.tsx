import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { FaceGuidance } from '../hooks/useFaceDetection';
import { createRef } from 'react';
import { setLocale } from '../i18n/core';
import { WithCatalogs } from '../test/render';
import { AccessoryBadges, FaceGuide, guidanceTone, QrGuide } from './FaceGuide';
import { HAIRLINE_PATH, HEAD_PATH, SHOULDERS_PATH } from './faceGuideShape';

describe('FaceGuide: visor del escáner facial', () => {
  it('el tono sigue a la guía: listo en verde, sin rostro neutro y cualquier problema como advertencia', () => {
    const tones = (list: FaceGuidance[]) => list.map(guidanceTone);
    expect(tones(['hold_still', 'ready'])).toEqual(['ok', 'ok']);
    expect(tones(['no_face', 'loading'])).toEqual(['idle', 'idle']);
    expect(tones(['multiple', 'cut_off', 'too_far', 'too_close', 'off_center', 'look_straight', 'too_dark', 'too_bright', 'moving', 'blurry', 'move'])).toEqual(Array(11).fill('warn'));
  });

  it('el borde rojo (tono «bad») solo lo pone el contexto de la toma de fotos (captureTone): aquí se dibuja su clase', () => {
    const { container } = render(<FaceGuide tone="bad" message="Centra tu rostro" stage="scan" />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--bad', 'face-scan--scan');
    expect(screen.getByRole('status')).toHaveClass('camera__message--face', 'camera__message--bad');
  });

  it('círculo con la guía del rostro (verde al estar bien colocado), anillo continuo que avanza con las fotos y UNA indicación en vivo', () => {
    const guide = createRef<HTMLDivElement>();
    const { container, rerender } = render(<FaceGuide ref={guide} tone="ok" message="Mantente quieto" progress={0.42} stage="align" />);
    const scan = container.querySelector('.face-scan');
    expect(scan).toHaveClass('face-scan', 'face-scan--ok', 'face-scan--align');
    expect(scan).not.toHaveClass('face-scan--complete');
    expect(guide.current).toBe(scan); // la detección mide el encuadre contra este círculo
    // La guía (decisión del dueño, 2026-10-07): óvalo con mentón, línea del cabello y hombros, cada trazo con su halo.
    const lines = [...container.querySelectorAll('.face-scan__guide .face-scan__line')].map((path) => path.getAttribute('d'));
    expect(lines).toEqual([HEAD_PATH, HAIRLINE_PATH, SHOULDERS_PATH]);
    expect(container.querySelectorAll('.face-scan__guide .face-scan__halo')).toHaveLength(3);
    expect(container.querySelector('.face-scan__guide')).toHaveAttribute('viewBox', '0 0 200 200');
    // El avance es continuo (sin marcas): el anillo lo dice a lectores de pantalla.
    const ring = screen.getByRole('img', { name: 'Captura al 42 %' });
    expect(ring).toHaveAttribute('data-value', '42');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Mantente quieto');
    expect(status).toHaveClass('camera__message--face', 'camera__message--ok');
    expect(status.querySelector('.camera__detail')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Captura completa' })).toBeNull();

    // Mientras se toman las fotos: el anillo avanza (sin luces ni insignias) y la cuenta va bajo la indicación (sin anunciarla).
    rerender(<FaceGuide tone="busy" message="Mantente quieto" detail="Capturas válidas: 12/32" progress={0.3} stage="scan" />);
    expect(screen.getByRole('img', { name: 'Captura al 30 %' })).toHaveAttribute('data-value', '30');
    expect(screen.getByText('Capturas válidas: 12/32')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.face-scan__badge')).toBeNull();

    // La prueba de vida: la misma tarjeta clara (ningún fondo de color: el destello se retiró, decisión del dueño).
    rerender(<FaceGuide tone="busy" message="Gira la cabeza" progress={0.75} stage="liveness" />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--liveness');
    expect(container.querySelector('.face-scan')?.className).not.toMatch(/flash/);

    rerender(<FaceGuide tone="busy" message={() => 'Confirmando tu identidad…'} progress={0.5} complete />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--complete');
    expect(container.querySelector('.face-scan')?.className).not.toMatch(/undefined|false/);
    // Completo: el anillo lleno es la señal (sin marca ✓ ni animación) y lo dice a lectores de pantalla.
    const full = screen.getByRole('img', { name: 'Captura completa' });
    expect(full).toHaveAttribute('data-value', '100');
    expect(screen.queryByRole('img', { name: 'Captura al 100 %' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Confirmando tu identidad…');

    rerender(<FaceGuide tone="idle" message="Coloca tu rostro en la guía" />);
    expect(screen.getByRole('img', { name: 'Captura al 0 %' })).toHaveAttribute('data-value', '0');
    rerender(<FaceGuide tone="warn" message="Centra tu rostro" stage="scan" />);
    expect(container.querySelector('.face-scan')).toHaveClass('face-scan--warn', 'face-scan--scan'); // aviso: color de aviso, la guía sigue a la vista
  });

  it('en inglés: el anillo y la marca de captura completa', async () => {
    await setLocale('en-US');
    render(<FaceGuide tone="busy" message="Confirming your identity…" complete />);
    expect(screen.getByRole('img', { name: 'Capture complete' })).toHaveAttribute('data-value', '100');
  });

  it('insignias de accesorios: un chip por código con su ícono y su nombre del catálogo; sin accesorios no se dibuja nada', () => {
    const { container, rerender } = render(<AccessoryBadges items={[]} />, { wrapper: WithCatalogs });
    expect(container).toBeEmptyDOMElement();
    rerender(<AccessoryBadges items={['GLASSES', 'HEADWEAR', 'SCARF']} />);
    const list = screen.getByRole('list', { name: 'Accesorios detectados' });
    expect(list).toHaveClass('accessory-badges');
    const badges = [...list.querySelectorAll('.accessory-badge')];
    expect(badges.map((badge) => badge.textContent?.trim())).toEqual(['Lentes', 'Gorra', 'SCARF']); // un código sin catálogo se muestra tal cual
    expect(container.querySelectorAll('.accessory-badge__icon svg')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/Quítate|quítate/); // la insignia ES el aviso: ninguna frase pide retirar nada
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
