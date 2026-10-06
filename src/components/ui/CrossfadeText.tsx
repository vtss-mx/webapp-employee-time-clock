import { useEffect, useRef, useState } from 'react';
import { resolveLazy, type LazyText } from '../../i18n/lazy';

interface CrossfadeTextProps {
  /** Texto vigente. Con una función se escribe al dibujarse (sigue al idioma activo, también el que se desvanece). */
  text: LazyText;
  className?: string;
}

interface Layers {
  /** Identidad del texto vigente (cada cambio estrena una capa). */
  id: number;
  current: LazyText;
  /** El texto anterior mientras se desvanece (null al terminar). */
  leaving: { id: number; text: LazyText } | null;
}

/**
 * Texto que cambia con un fundido cruzado (componente propio): el anterior se desvanece mientras el nuevo aparece en el
 * mismo lugar (las dos capas se apilan en una cuadrícula: nada se desplaza). Solo se guarda lo que el llamador entrega
 * (una función se vuelve a escribir al dibujarse, nunca un texto ya traducido) y el anterior se retira al terminar su
 * animación. Con "reducir movimiento" el cambio es inmediato (el CSS oculta la capa que sale).
 */
export function CrossfadeText({ text, className }: CrossfadeTextProps) {
  const now = resolveLazy(text);
  const [layers, setLayers] = useState<Layers>({ id: 0, current: text, leaving: null });
  // Cambió lo que dice (no solo la función que lo escribe): el vigente pasa a desvanecerse y entra el nuevo.
  if (resolveLazy(layers.current) !== now) setLayers({ id: layers.id + 1, current: text, leaving: { id: layers.id, text: layers.current } });
  const { leaving } = layers;
  // Al terminar de desvanecerse se retira (con el evento nativo `animationend`: el mismo en todos los navegadores).
  const leavingRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = leavingRef.current;
    if (!node) return;
    const done = () => setLayers((prev) => ({ ...prev, leaving: null }));
    node.addEventListener('animationend', done);
    return () => node.removeEventListener('animationend', done);
  }, [leaving?.id]);
  return (
    <span className={`crossfade ${className ?? ''}`.trim()}>
      {leaving && (
        <span key={leaving.id} ref={leavingRef} className="crossfade__layer crossfade__layer--leaving" aria-hidden>
          {resolveLazy(leaving.text)}
        </span>
      )}
      <span key={layers.id} className="crossfade__layer crossfade__layer--current">
        {now}
      </span>
    </span>
  );
}
