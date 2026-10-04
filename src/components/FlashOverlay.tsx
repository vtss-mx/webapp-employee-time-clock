import { ScanFace } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

interface FlashOverlayProps {
  /** Color que se pinta ('#RRGGBB'); null = no se muestra nada. */
  color: string | null;
  /** Color en curso (0 = el primero) y cuántos son: puntos de avance bajo la indicación. */
  index: number;
  total: number;
  /**
   * Dónde está el óvalo del visor en la pantalla: por esa ventana se sigue viendo la cámara en su
   * lugar (la persona mantiene el rostro encuadrado). Sin él (o sin medida), todo se pinta de color.
   */
  locate?: () => DOMRect | null | undefined;
  /** Indicación sobre el color. */
  hint?: string;
}

/** Ventana elíptica sobre el óvalo (posición calculada en la pantalla, en px). */
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
 * pintada con el color del reto, con una ventana sobre el óvalo para que la cámara siga a la vista y
 * una indicación breve. El color cambia al instante, también con "reducir movimiento": es la prueba
 * de seguridad (solo la indicación entra con una transición, que esa preferencia apaga).
 */
export function FlashOverlay({ color, index, total, locate, hint = 'Mantén tu rostro frente a la pantalla' }: FlashOverlayProps) {
  const [hole, setHole] = useState<DOMRect | null>(null);
  const locateRef = useRef(locate);
  locateRef.current = locate;
  const active = color !== null;

  // Se mide al empezar el destello (antes de pintar): dura un instante y el visor no se mueve.
  useLayoutEffect(() => {
    if (!active) return;
    const rect = locateRef.current?.();
    setHole(rect && rect.width > 0 && rect.height > 0 ? rect : null);
  }, [active]);

  if (color === null) return null;
  const style = { '--flash-color': color, ...(hole ? windowStyle(hole) : {}) } as CSSProperties;
  return createPortal(
    <div className={`flash ${hole ? 'flash--window' : ''}`.trim()} style={style} role="status">
      <div className="flash__hint">
        <ScanFace size={20} aria-hidden />
        {hint}
      </div>
      <ol className="flash__steps" aria-label={`Color ${index + 1} de ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={i < index ? 'is-done' : i === index ? 'is-current' : ''} />
        ))}
      </ol>
    </div>,
    document.body,
  );
}
