import { describe, expect, it } from 'vitest';
import { sha256Hex } from './digest';

describe('sha256Hex', () => {
  it('la huella de una captura es su SHA-256 en hexadecimal', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
