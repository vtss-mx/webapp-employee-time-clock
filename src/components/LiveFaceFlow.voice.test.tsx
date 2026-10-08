import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advance, renderFlow, resetFaceFlow } from '../test/faceFlow';
import { samplePolicy } from '../test/fixtures';
import { cancelCount, spokenTexts } from '../test/speechSynthesis';

/*
 * Guía por voz del registro (decisión del dueño, 2026-10-08): con la guía encendida, `LiveFaceFlow` lee la indicación
 * de posición al abrir la cámara y muestra el botón de silencio en el encabezado; silenciarlo calla la voz y cambia su
 * etiqueta. Apagada (política de omisión), no hay voz ni botón.
 */
vi.mock('../hooks/useCamera', async () => (await import('../test/faceFlowMocks')).cameraModule());
vi.mock('../hooks/useFaceDetection', async (original) => (await import('../test/faceFlowMocks')).detectionModule(await original()));

const voiceOn = { ...samplePolicy, voice_guidance_enabled: true };

beforeEach(resetFaceFlow);
afterEach(() => vi.useRealTimers());

describe('LiveFaceFlow: guía por voz', () => {
  it('lee la posición al entrar y muestra el control de silencio', async () => {
    renderFlow({ policy: voiceOn });
    await advance(0); // carga de la preferencia del dispositivo y del cuadro de posición
    expect(screen.getByRole('button', { name: 'Silenciar la guía por voz' })).toBeInTheDocument();
    expect(spokenTexts()).toContain('Coloca tu rostro dentro de la guía y mira al frente.');
  });

  it('silenciar corta la voz y cambia la etiqueta a «Activar»', async () => {
    renderFlow({ policy: voiceOn });
    await advance(0);
    const before = cancelCount();
    fireEvent.click(screen.getByRole('button', { name: 'Silenciar la guía por voz' }));
    expect(screen.getByRole('button', { name: 'Activar la guía por voz' })).toBeInTheDocument();
    expect(cancelCount()).toBeGreaterThan(before);
  });

  it('con la guía apagada (política de omisión) no hay voz ni control de silencio', async () => {
    renderFlow();
    await advance(0);
    expect(screen.queryByRole('button', { name: 'Silenciar la guía por voz' })).toBeNull();
    expect(spokenTexts()).toEqual([]);
  });
});
