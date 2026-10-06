/**
 * Espera a que la cámara entregue un cuadro NUEVO (`requestVideoFrameCallback`), como mucho `maxWaitMs`.
 *
 * Las 36 fotos del registro facial se toman seguidas: sin esta espera, en un teléfono con poca luz (la cámara baja a
 * 10-15 cuadros por segundo) dos fotos podrían ser el MISMO cuadro, que no aporta nada (el servidor descarta los
 * repetidos). Sin `requestVideoFrameCallback` (un navegador antiguo) o sin video no se espera: la pausa entre fotos ya
 * da el ritmo. Nunca se queda colgada: una cámara que se congela se resuelve al agotarse el tope.
 */
export function nextVideoFrame(video: HTMLVideoElement | null | undefined, maxWaitMs: number): Promise<void> {
  if (!video || typeof video.requestVideoFrameCallback !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    let handle = 0;
    const timer = window.setTimeout(() => {
      video.cancelVideoFrameCallback(handle);
      resolve();
    }, maxWaitMs);
    handle = video.requestVideoFrameCallback(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}
