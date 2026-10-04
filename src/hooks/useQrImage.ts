import { useCallback, useEffect, useState } from 'react';
import { importWithRetry } from '../utils/importRetry';

interface QrImageOptions {
  /** Ancho en píxeles de la imagen (se escala con CSS sin perder nitidez). */
  width?: number;
  /** Color de los módulos (el fondo siempre es blanco: así lo leen todos los lectores). */
  dark?: string;
}

export interface QrImage {
  /** Imagen (data URL) del texto actual; null mientras se dibuja o si no se pudo dibujar. */
  src: string | null;
  /** No se pudo dibujar (la librería no se descargó): `retry` lo intenta de nuevo. */
  error: Error | null;
  retry: () => void;
}

const LOAD_ERROR = 'No se pudo preparar el código QR. Revisa tu conexión e intenta de nuevo.';

/**
 * Código QR (data URL) dibujado en el navegador. La librería se carga solo cuando hace falta (y se
 * repite una vez si la descarga falla) y el servidor no genera imágenes. Si aun así no se puede
 * dibujar, devuelve el error para que la pantalla lo explique y ofrezca `retry` (vuelve a descargarla):
 * sin esto, el lugar del código quedaría cargando para siempre.
 */
export function useQrImage(text: string | null | undefined, { width = 232, dark = '#0b1b3f' }: QrImageOptions = {}): QrImage {
  const [image, setImage] = useState<{ text: string; src: string } | null>(null);
  const [failure, setFailure] = useState<{ text: string; error: Error } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!text) return undefined;
    let cancelled = false;
    importWithRetry(() => import('qrcode'))
      .then(({ toDataURL }) => toDataURL(text, { margin: 1, width, errorCorrectionLevel: 'M', color: { dark, light: '#ffffff' } }))
      .then((src) => !cancelled && setImage({ text, src }))
      .catch(() => !cancelled && setFailure({ text, error: new Error(LOAD_ERROR) }));
    return () => {
      cancelled = true;
    };
  }, [text, width, dark, attempt]);
  const retry = useCallback(() => {
    setFailure(null);
    setAttempt((n) => n + 1);
  }, []);
  // Solo la imagen (o el error) del texto actual: al cambiar de código nunca se muestra el anterior.
  return { src: image && image.text === text ? image.src : null, error: failure && failure.text === text ? failure.error : null, retry };
}
