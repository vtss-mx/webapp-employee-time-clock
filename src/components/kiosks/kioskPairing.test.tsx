import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QrImage } from '../../hooks/useQrImage';
import type { KioskCreated } from '../../types';
import { kioskPairingMessage, kioskPairingUrl } from './kioskPairing';

// Cómo se dibuja el QR se prueba en `useQrImage`; aquí, qué muestra el popup mientras se dibuja o si no se pudo.
const qr = vi.hoisted((): { state: QrImage } => ({ state: { src: null, error: null, retry: () => undefined } }));
vi.mock('../../hooks/useQrImage', () => ({ useQrImage: () => qr.state }));

const created: KioskCreated = {
  kiosk: { id: 9, site_id: 3, name: 'Entrada', paired: false, paired_at: null, device_name: null, last_seen_at: null, pairing_expires_at: null, created_at: '2026-10-01T00:00:00Z' },
  pairing_code: 'ABCDE-23456',
  pairing_expires_at: '2026-10-06T10:00:00Z',
};

describe('popup del código de vinculación', () => {
  it('el código va en el fragmento de la dirección (nunca llega a un servidor)', () => {
    expect(kioskPairingUrl('AB CD')).toBe(`${window.location.origin}/kiosk#pair=AB%20CD`);
    expect(kioskPairingMessage(created)).toMatchObject({ dismissible: false, key: 'kiosk-pairing-9', eyebrow: 'Kiosco creado' });
  });

  it('mientras se dibuja el QR, su lugar; si no se pudo, "Dibujar el QR de nuevo" (el código sigue a la mano)', async () => {
    const view = render(<>{kioskPairingMessage(created).body}</>);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(/^Vence el .*2026/)).toBeInTheDocument();
    const retry = vi.fn();
    qr.state = { src: null, error: new Error('sin red'), retry };
    view.rerender(<>{kioskPairingMessage(created).body}</>);
    await userEvent.click(screen.getByRole('button', { name: 'Dibujar el QR de nuevo' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText('ABCDE-23456')).toBeInTheDocument();
  });
});
