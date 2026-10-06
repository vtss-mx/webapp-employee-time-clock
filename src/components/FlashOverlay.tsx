import { ScanFace } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';

interface FlashOverlayProps {
  /** Color que se pinta ('#RRGGBB'); null = no se muestra nada. */
  color: string | null;
  /** Color en curso (0 = el primero) y cuántos son: puntos de avance bajo la indicación. */
  index: number;
  total: number;
  /**
   * Dónde está el círculo del visor (con su anillo) en la pantalla: por esa ventana se sigue viendo la cámara en su
   * lugar (la persona mantiene el rostro encuadrado y ve avanzar las fotos). Sin él (o sin medida), todo se pinta de color.
   */
  locate?: () => DOMRect | null | undefined;
  /** Indicación sobre el color (por omisión, mantener el rostro frente a la pantalla). */
  hint?: string;
}

/** Ventana sobre el círculo del visor (posición calculada en la pantalla, en px; un círculo: radios iguales). */
function windowStyle(rect: DOMRect): Record<string, string> {
  return {
    '--flash-x': `${rect.left + rect.width / 2}px`,
    '--flash-y': `${rect.top + rect.height / 2}px`,
    '--flash-rx': `${rect.width / 2}px`,
    '--flash-ry': `${rect.height / 2}px`,
  };
}

/**
 * Destello de colores de la prueba de vida: capa a pantalla completa (portal, sobre todo lo demás)
 * pintada con el color del reto, con una ventana sobre el círculo para que la cámara siga a la vista y
 * una indicación breve. El color cambia al instante, también con "reducir movimiento": es la prueba
 * de seguridad (solo la indicación entra con una transición, que esa preferencia apaga).
 */
export function FlashOverlay({ color, index, total, locate, hint }: FlashOverlayProps) {
  const t = useT();
  const [hole, setHole] = useState<DOMRect | null>(null);
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const active = color !== null;

  // Se mide al empezar el destello (antes de pintar) y con cada color. El visor puede acomodarse un instante después
  // (cambia el título de la etapa y el círculo se mide con unidades de contenedor): se mide otra vez en el siguiente
  // cuadro, así la ventana siempre queda sobre el círculo.
  useLayoutEffect(() => {
    if (!active) return;
    const measure = () => {
      const rect = locateRef.current?.();
      setHole(rect && rect.width > 0 && rect.height > 0 ? rect : null);
    };
    measure();
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [active, index]);

  if (color === null) return null;
  const style = { '--flash-color': color, ...(hole ? windowStyle(hole) : {}) } as CSSProperties;
  return createPortal(
    <div className={`flash ${hole ? 'flash--window' : ''}`.trim()} style={style} role="status">
      <div className="flash__hint">
        <ScanFace size={20} aria-hidden />
        {hint ?? t('face.flash.hint')}
      </div>
      <ol className="flash__steps" aria-label={t('face.flash.progress', { current: index + 1, total })}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} />
        ))}
      </ol>
    </div>,
    document.body,
  );
}
