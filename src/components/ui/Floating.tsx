import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** Separación entre el campo y la superficie, y margen mínimo con los bordes de la pantalla. */
const GAP = 6;
const GUTTER = 16;

interface FloatingProps {
  /** Elemento junto al que se abre (el control del campo). */
  anchorRef: RefObject<HTMLElement | null>;
  /** Para el cierre al tocar fuera: el campo y la superficie cuentan como "dentro". */
  floatingRef?: RefObject<HTMLDivElement | null>;
  className: string;
  /** Mismo ancho que el campo (p. ej. la lista de países bajo el teléfono o la lista de idiomas). */
  matchWidth?: boolean;
  /** Ancho mínimo en píxeles (una lista cuyo contenido debe caber en una línea aunque el campo sea angosto). */
  minWidth?: number;
  /** Con qué borde del campo se alinea: el izquierdo (`start`) o el derecho (`end`, un control pegado a la derecha). */
  align?: 'start' | 'end';
  children: ReactNode;
}

interface Placement {
  top: number;
  left: number;
  above: boolean;
  width?: number;
}

/**
 * Base ÚNICA de las superficies flotantes de los campos (selector de país, calendario, listas).
 *
 * Se monta fuera del formulario con un portal y se posiciona con `position: fixed` contra el campo.
 * Dentro de la página, el `overflow: hidden` de los paneles la recortaría y las animaciones de
 * entrada de cada sección (crean su propia capa) dejarían la sección siguiente encima. En una
 * ventana emergente se monta en su capa, para quedar sobre ella sin salir de su foco.
 * Se abre hacia arriba si abajo no cabe, nunca sale de los bordes de la pantalla y sigue al campo al
 * desplazar o cambiar el tamaño.
 */
export function Floating({ anchorRef, floatingRef, className, matchWidth = false, minWidth, align = 'start', children }: FloatingProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = floatingRef ?? ownRef;
  const [placement, setPlacement] = useState<Placement | null>(null);
  const container = anchorRef.current?.closest<HTMLElement>('.msg-layer') ?? document.body;

  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const surface = ref.current;
      if (!anchor || !surface) return;
      const width = Math.max(matchWidth ? anchor.width : surface.offsetWidth, minWidth ?? 0);
      const height = surface.offsetHeight;
      const below = window.innerHeight - anchor.bottom - GAP - GUTTER;
      const above = height > below && anchor.top - GAP - GUTTER > below;
      const start = align === 'end' ? anchor.left + anchor.width - width : anchor.left;
      setPlacement({
        top: above ? anchor.top - GAP - height : anchor.bottom + GAP,
        left: Math.max(GUTTER, Math.min(start, window.innerWidth - GUTTER - width)),
        above,
        width: matchWidth ? width : undefined,
      });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    // Si cambia su alto (al filtrar países o cambiar de vista), se recoloca (importa al abrir hacia arriba).
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    if (observer && ref.current) observer.observe(ref.current);
    // En captura: también el desplazamiento de contenedores internos (ventanas, listas).
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [anchorRef, ref, matchWidth, minWidth, align]);

  return createPortal(
    <div
      ref={ref}
      className={`floating ${placement?.above ? 'floating--above' : ''} ${className}`}
      // Hasta medirse no se ve (evita un parpadeo en la esquina de la pantalla).
      style={placement ? { top: placement.top, left: placement.left, width: placement.width, minWidth } : { visibility: 'hidden', minWidth }}
    >
      {children}
    </div>,
    container,
  );
}
