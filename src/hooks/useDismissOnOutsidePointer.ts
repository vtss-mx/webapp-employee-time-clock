import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Mientras `active`, un toque o clic fuera de `ref` llama a `onDismiss` (menús y calendarios flotantes). */
export function useDismissOnOutsidePointer(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void): void {
  const onDismissRef = useRef(onDismiss);
  useLayoutEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismissRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [active, ref]);
}
