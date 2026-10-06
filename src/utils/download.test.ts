import { afterEach, describe, expect, it, vi } from 'vitest';
import { base64ToBlob, saveFile } from './download';

afterEach(() => vi.useRealTimers());

describe('archivos del backend (base64)', () => {
  it('base64 → Blob con su tipo y sus bytes', async () => {
    const blob = base64ToBlob(btoa('hola'), 'application/pdf');
    expect(blob.type).toBe('application/pdf');
    expect(await blob.text()).toBe('hola');
  });

  it('se descarga con su nombre por un enlace temporal; la URL se libera después', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:comprobante');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });

    saveFile(new Blob(['x']), 'pago.pdf');
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe('pago.pdf');
    expect(clicks[0].href).toBe('blob:comprobante');
    expect(clicks[0].isConnected).toBe(false); // el enlace no se queda en la página
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(30_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:comprobante');
  });
});
