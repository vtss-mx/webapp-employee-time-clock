import type { FaceBox } from '../utils/faceBurst';

/*
 * La guía del rostro (decisión del dueño del producto, 2026-10-07: «que se pinte algo así en el dispositivo para que el
 * usuario ponga bien su rostro»): UN contorno con forma de rostro real —óvalo con el mentón más angosto, la línea del
 * cabello y los hombros— dibujado por la app (SVG propio, nada copiado de otra marca) en el cuadro de 200 × 200 del
 * círculo del visor. Lo que se dibuja (`FaceGuide`) y lo que se exige (`useFaceAutoCapture`) salen de AQUÍ: el rostro
 * detectado debe caber dentro del contorno y quedar centrado en él, para que la guía y la validez sean la misma cosa.
 */

/** Lado del cuadro del dibujo (el círculo del visor lo recorta: `clip-path: circle(50%)`). */
export const GUIDE_VIEWBOX = 200;

/** Óvalo de la cabeza: ancho en las sienes (x 44-156, el 56 % del círculo) y mentón más angosto (y 24-172). */
export const HEAD_PATH =
  'M100 24C136 24 156 52 156 90C156 122 140 150 122 163C114 169 106 172 100 172C94 172 86 169 78 163C60 150 44 122 44 90C44 52 64 24 100 24Z';
/** Línea del cabello: de sien a sien, por dentro del óvalo (deja el cabello arriba). */
export const HAIRLINE_PATH = 'M60 82C70 50 130 50 140 82';
/** Hombros: dos trazos desde el borde del círculo hasta el cuello, lejos del rostro. */
export const SHOULDERS_PATH = 'M8 200C18 178 46 168 76 165M192 200C182 178 154 168 124 165';

/**
 * Dónde cae la caja del detector (BlazeFace: de las cejas al mentón y de oreja a oreja, casi cuadrada) cuando el
 * rostro llena la guía: justo bajo la línea del cabello hasta el mentón y el ancho del óvalo a la altura de los ojos.
 * Medido con un rostro real en el harness (`scratchpad/enrollment-v2/harness/calibrate.mjs`): la caja mide ≈ 0.9 del
 * ancho de la cabeza con cabello y ≈ 0.7 de su alto, con el centro por debajo del centro del óvalo. Contra ESTA caja se
 * mide el encuadre (distancia y centrado), en unidades del cuadro de 200.
 */
export const TARGET_BOX: Readonly<FaceBox> = { x: 50, y: 66, width: 100, height: 106 };

/**
 * La caja objetivo en píxeles del VIDEO (el espacio del detector), a partir de la geometría real de la página: el
 * rectángulo del círculo de la guía (`.face-scan`) y el del `<video>` con `object-fit: cover` (el video se escala al
 * mayor factor que llena su caja y se recorta centrado). En el escáner el `<video>` se dibuja respecto al círculo
 * (decisión del dueño, 2026-10-07: su caja tiene la relación de aspecto real del flujo, su lado corto mide
 * `--face-fov` diámetros y su centro es el del círculo, sobresaliendo del visor, que lo recorta): `getBoundingClientRect`
 * entrega esa caja ya transformada, los dos factores de escala coinciden y no hay recorte que compensar; la misma
 * cuenta vale cuando el video llena el visor. El círculo va centrado horizontalmente sobre el video, así el espejo de la
 * cámara frontal (`scaleX(-1)`) no cambia la caja. Sin geometría (la página aún no mide, un lienzo sin tamaño), la guía
 * se toma como el círculo inscrito y centrado en el video: lo que se ve en un teléfono en vertical.
 */
export function guideTarget(video: Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'>, videoRect: DOMRect | null, guideRect: DOMRect | null): FaceBox {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!videoRect?.width || !videoRect.height || !guideRect?.width) {
    const diameter = Math.min(vw, vh);
    const unit = diameter / GUIDE_VIEWBOX;
    return {
      x: (vw - diameter) / 2 + TARGET_BOX.x * unit,
      y: (vh - diameter) / 2 + TARGET_BOX.y * unit,
      width: TARGET_BOX.width * unit,
      height: TARGET_BOX.height * unit,
    };
  }
  const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
  const offsetX = videoRect.left + (videoRect.width - vw * scale) / 2;
  const offsetY = videoRect.top + (videoRect.height - vh * scale) / 2;
  const unit = guideRect.width / GUIDE_VIEWBOX;
  return {
    x: (guideRect.left + TARGET_BOX.x * unit - offsetX) / scale,
    y: (guideRect.top + TARGET_BOX.y * unit - offsetY) / scale,
    width: (TARGET_BOX.width * unit) / scale,
    height: (TARGET_BOX.height * unit) / scale,
  };
}
