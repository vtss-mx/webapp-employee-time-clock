import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

type Refs = RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>;

/**
 * Mientras `active`, un toque o clic fuera de `refs` llama a `onDismiss` (menús y calendarios
 * flotantes). Admite varios elementos: el campo y su superficie flotante, que vive en un portal.
 */
export function useDismissOnOutsidePointer(refs: Refs, active: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss);
  const refsRef = useRef(refs);
  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
    refsRef.current = refs;
  });
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      const list = Array.isArray(refsRef.current) ? refsRef.current : [refsRef.current];
      if (!list.some((ref) => ref.current?.contains(event.target as Node))) onDismissRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [active]);
}
