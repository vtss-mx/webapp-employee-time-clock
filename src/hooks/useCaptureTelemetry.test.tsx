import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CameraController } from './useCamera';
import { useCaptureTelemetry } from './useCaptureTelemetry';

/** Un video con `requestVideoFrameCallback` que la prueba hace avanzar. */
function fakeVideo() {
  let pending: ((now: number) => void) | null = null;
  const video = {
    requestVideoFrameCallback: vi.fn((callback: (now: number) => void) => {
      pending = callback;
      return 1;
    }),
    cancelVideoFrameCallback: vi.fn(),
  };
  return { video, frame: (now: number) => pending?.(now) };
}

const cameraWith = (video: unknown, status: CameraController['status']) =>
  ({ videoRef: { current: video }, status, devices: [], videoTrack: () => null }) as unknown as CameraController;

describe('useCaptureTelemetry (antifraude 1b)', () => {
  it('mide el ritmo de los cuadros mientras la cámara da imagen y lo manda con la toma', () => {
    const { video, frame } = fakeVideo();
    const { result, unmount } = renderHook(() => useCaptureTelemetry(cameraWith(video, 'active'), ['obs']));
    for (const now of [0, 33, 66, 100]) frame(now);
    const telemetry = JSON.parse(result.current()) as { v: number; frames: { count: number } };
    expect(telemetry.v).toBe(1);
    expect(telemetry.frames.count).toBe(3);
    unmount();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
  });

  it('sin imagen (cámara abriéndose o sin video) no mide el ritmo', () => {
    const { video } = fakeVideo();
    const waiting = renderHook(() => useCaptureTelemetry(cameraWith(video, 'requesting'), []));
    expect(JSON.parse(waiting.result.current())).toMatchObject({ frames: null });
    expect(video.requestVideoFrameCallback).not.toHaveBeenCalled();
    const noVideo = renderHook(() => useCaptureTelemetry(cameraWith(null, 'active'), []));
    expect(JSON.parse(noVideo.result.current())).toMatchObject({ frames: null });
  });
});
