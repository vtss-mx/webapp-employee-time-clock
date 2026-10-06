import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { loaded, sized, usePointerEvents } from '../../test/pointer';
import { cropBox, initialView, type CropView, type Natural } from '../../utils/avatarCrop';
import { AvatarCropper, AvatarCropPreview } from './AvatarCropper';

const PHOTO = { width: 1000, height: 600 };
let latest: CropView = { zoom: 1, cx: 0, cy: 0 };

/** El recorte con su estado, como lo usa el cargador. */
function Harness({ disabled = false, onError = vi.fn() }: { disabled?: boolean; onError?: () => void }) {
  const [natural, setNatural] = useState<Natural | null>(null);
  const [view, setView] = useState<CropView>({ zoom: 1, cx: 0, cy: 0 });
  latest = view;
  return (
    <AvatarCropper
      src="blob:elegida"
      natural={natural}
      view={view}
      disabled={disabled}
      onChange={setView}
      onLoad={(size) => {
        setNatural(size);
        setView(initialView(size));
      }}
      onError={onError}
      overlay={<span>capa</span>}
    />
  );
}

function ready() {
  const view = render(<Harness />);
  const viewport = screen.getByRole('group', { name: 'Recorte de la foto' });
  const image = viewport.querySelector('img') as HTMLImageElement;
  expect(viewport).toHaveAttribute('aria-busy', 'true');
  expect(viewport).toHaveAttribute('tabindex', '-1');
  loaded(image, PHOTO.width, PHOTO.height);
  fireEvent.load(image);
  sized(viewport, 300);
  return { ...view, viewport, image };
}

beforeEach(() => usePointerEvents());
afterEach(() => vi.unstubAllGlobals());

describe('AvatarCropper', () => {
  it('al cargar la foto: el cuadrado más grande al centro, con su acercamiento y las instrucciones', () => {
    const { viewport, image } = ready();
    expect(viewport).not.toHaveAttribute('aria-busy');
    expect(viewport).toHaveAttribute('tabindex', '0');
    expect(viewport).toHaveAccessibleDescription(/Arrastra la foto/);
    expect(image).toHaveClass('is-ready');
    expect(image.style.width).toBe('166.667%');
    expect(screen.getByRole('slider', { name: 'Acercamiento' })).toHaveAttribute('aria-valuetext', '1 ×');
    expect(screen.getByText('capa')).toBeInTheDocument();
    expect(cropBox(PHOTO, latest)).toEqual({ x: 200, y: 0, size: 600 });
  });

  it('se arrastra con el ratón o el dedo y se acerca pellizcando con dos dedos', () => {
    const { viewport } = ready();
    fireEvent.pointerMove(viewport, { pointerId: 9, clientX: 50, clientY: 50 }); // sin apoyar: nada
    expect(latest.cx).toBe(500);
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(HTMLElement.prototype.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 50, clientY: 100 }); // 50 px de 300 = 100 px de la foto
    expect(latest).toMatchObject({ cx: 600, cy: 300 });
    fireEvent.pointerDown(viewport, { pointerId: 2, clientX: 150, clientY: 100 });
    fireEvent.pointerMove(viewport, { pointerId: 2, clientX: 250, clientY: 100 }); // de 100 a 200 px: el doble
    expect(latest.zoom).toBe(2);
    fireEvent.pointerUp(viewport, { pointerId: 2 });
    fireEvent.pointerCancel(viewport, { pointerId: 1 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(latest.zoom).toBe(2);
    // Dos dedos en el mismo punto: no hay distancia de la cual partir.
    fireEvent.pointerDown(viewport, { pointerId: 3, clientX: 10, clientY: 10 });
    fireEvent.pointerDown(viewport, { pointerId: 4, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(viewport, { pointerId: 4, clientX: 90, clientY: 10 });
    expect(latest.zoom).toBe(2);
  });

  it('la rueda acerca sin desplazar la página; el deslizador y sus botones también', async () => {
    const { viewport } = ready();
    const wheel = new WheelEvent('wheel', { deltaY: -200, cancelable: true });
    act(() => {
      viewport.dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(true);
    expect(latest.zoom).toBeCloseTo(Math.exp(0.3), 5);
    fireEvent.change(screen.getByRole('slider', { name: 'Acercamiento' }), { target: { value: '3' } });
    expect(latest.zoom).toBe(3);
    await userEvent.click(screen.getByRole('button', { name: 'Alejar' }));
    expect(latest.zoom).toBeCloseTo(2.9, 5);
    await userEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(latest.zoom).toBeCloseTo(3, 5);
  });

  it('con el teclado: flechas mueven la foto (Mayús, más), + y − acercan y 0 o Inicio la centran', () => {
    const { viewport } = ready();
    viewport.focus();
    fireEvent.keyDown(viewport, { key: '+' });
    fireEvent.keyDown(viewport, { key: '=' });
    expect(latest.zoom).toBeCloseTo(1.2, 5);
    const side = 600 / latest.zoom;
    fireEvent.keyDown(viewport, { key: 'ArrowRight' });
    expect(latest.cx).toBeCloseTo(500 - side * 0.05, 5);
    fireEvent.keyDown(viewport, { key: 'ArrowLeft', shiftKey: true });
    expect(latest.cx).toBeCloseTo(500 - side * 0.05 + side * 0.2, 5);
    fireEvent.keyDown(viewport, { key: 'ArrowDown' });
    fireEvent.keyDown(viewport, { key: 'ArrowUp' });
    expect(latest.cy).toBeCloseTo(300, 5);
    fireEvent.keyDown(viewport, { key: '-' });
    fireEvent.keyDown(viewport, { key: '_' });
    expect(latest.zoom).toBe(1);
    fireEvent.keyDown(viewport, { key: '+' });
    fireEvent.keyDown(viewport, { key: '0' });
    expect(latest).toEqual(initialView(PHOTO));
    fireEvent.keyDown(viewport, { key: '+' });
    fireEvent.keyDown(viewport, { key: 'Home' });
    expect(latest).toEqual(initialView(PHOTO));
    const before = { ...latest };
    expect(fireEvent.keyDown(viewport, { key: 'a' })).toBe(true); // otra tecla: no es del recorte
    expect(latest).toEqual(before);
  });

  it('mientras carga o se guarda (deshabilitado) no responde; una foto que el navegador no abre avisa', () => {
    const onError = vi.fn();
    const { rerender } = render(<Harness disabled onError={onError} />);
    const viewport = screen.getByRole('group');
    fireEvent.keyDown(viewport, { key: '+' });
    fireEvent.pointerDown(viewport, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(HTMLElement.prototype.setPointerCapture).not.toHaveBeenCalled();
    const image = viewport.querySelector('img') as HTMLImageElement;
    loaded(image, 800, 800);
    fireEvent.load(image);
    expect(screen.getByRole('slider')).toBeDisabled();
    act(() => {
      viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, cancelable: true }));
    });
    expect(latest.zoom).toBe(1);
    expect(screen.getByRole('group').closest('.avatar-cropper')).toHaveClass('is-disabled');
    fireEvent.error(image);
    expect(onError).toHaveBeenCalled();
    rerender(<Harness onError={onError} />);
  });

  it('la vista previa circular (confirmación) y los textos en inglés', async () => {
    render(<AvatarCropPreview src="blob:x" natural={PHOTO} view={initialView(PHOTO)} label="Así se verá" />);
    expect(screen.getByRole('img', { name: 'Así se verá' }).querySelector('img')).toHaveStyle({ width: '166.667%' });
    await act(() => setLocale('en-US'));
    render(<Harness />);
    expect(screen.getByRole('group', { name: 'Photo crop' })).toBeInTheDocument();
  });
});
