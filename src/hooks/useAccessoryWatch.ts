import { useEffect, useRef } from 'react';
import { ApiError } from '../services/apiClient';
import { faceService } from '../services/verificationService';
import type { CaptureOptions } from './useCamera';
import { config } from '../utils/config';
import { detectedAccessories, reportedAccessories } from '../utils/faceErrors';

interface AccessoryWatchOptions {
  /** Vigila mientras hay un rostro a la vista en una fase de frente (alineación y toma de fotos). */
  enabled: boolean;
  /** Toma un cuadro de la cámara (el mismo de `useCamera`); si lanza (sin imagen) se salta ese turno. */
  captureFrame: (options?: CaptureOptions) => Promise<Blob>;
  /** La persona está exenta de prenda de cabeza (misma política de la validación previa). */
  allowHeadwear: boolean;
  /** Antes de cada turno: ¿hay un rostro que valga la pena validar? (omitido = siempre). */
  ready?: () => boolean;
  /** Los accesorios que el servidor reportó (vacío = ninguno). Solo se llama cuando una respuesta los decide. */
  onAccessories: (codes: string[]) => void;
}

/**
 * Vigilancia CONTINUA de accesorios (decisión del dueño del producto, 2026-10-07: «en cualquier momento del flujo… si la
 * persona trae cubrebocas/lentes debe aparecer la insignia»): mientras `enabled`, cada `config.faceAccessoryCheckIntervalMs`
 * toma UN cuadro y lo valida en el servidor (`/face/check`), actualizando las insignias con cada respuesta (aparecen al
 * ponerse un accesorio, desaparecen al quitarlo), en la foto inicial y durante las 32 capturas. Reglas:
 * - **Throttleada y sin solaparse** (un temporizador que se reagenda al terminar cada validación): nunca spamea, así no
 *   dispara la alerta de peticiones lentas (la ruta facial alerta desde 2.5 s) ni rompe los presupuestos.
 * - **Un cuadro malo no borra las insignias**: una falla de calidad/pose/red deja las insignias como estaban y se espera
 *   al siguiente turno; solo una respuesta que decide accesorios las cambia (aceptada: todos los detectados; 422 por
 *   accesorio: los bloqueados).
 * - El cuadro que toma es chico (`faceAccessoryCheckPx`) y solo va a `/face/check`: nunca entra en la toma enviada, así
 *   el candado de «una sola resolución por toma» (`useFrontalCapture`) queda intacto.
 */
export function useAccessoryWatch({ enabled, captureFrame, allowHeadwear, ready, onAccessories }: AccessoryWatchOptions) {
  const onAccessoriesRef = useRef(onAccessories);
  onAccessoriesRef.current = onAccessories;
  const captureRef = useRef(captureFrame);
  captureRef.current = captureFrame;
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => void run(), config.faceAccessoryCheckIntervalMs);
    };
    const run = async () => {
      if (!readyRef.current || readyRef.current()) {
        try {
          const frame = await captureRef.current({ maxSide: config.faceAccessoryCheckPx });
          onAccessoriesRef.current(reportedAccessories(await faceService.check([frame], allowHeadwear)));
        } catch (error) {
          // 422 por accesorio bloqueado: muestra los que detectó. Otra falla (sin rostro, oscuro, red): deja las
          // insignias como están (no se quitan por un cuadro malo).
          if (error instanceof ApiError && error.code === 'ACCESSORIES_DETECTED') onAccessoriesRef.current(detectedAccessories(error));
        }
      }
      if (!stopped) schedule();
    };
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [enabled, allowHeadwear]);
}
