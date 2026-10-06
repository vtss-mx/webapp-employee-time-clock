import { vi } from 'vitest';

/**
 * jsdom no trae eventos de puntero ni la captura del puntero: este doble (un MouseEvent con `pointerId`) deja
 * probar arrastrar y pellizcar con `fireEvent.pointerDown/Move/Up` como en un navegador.
 */
export function usePointerEvents(): void {
  class TestPointerEvent extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  HTMLElement.prototype.setPointerCapture = vi.fn();
}

/** Un elemento que mide `width` × `height` en pantalla (jsdom no calcula diseño). */
export function sized(element: Element, width: number, height = width): void {
  element.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}) });
}

/** La imagen "cargó" con su tamaño natural (jsdom no decodifica imágenes). */
export function loaded(image: HTMLImageElement, width: number, height: number): void {
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
}
