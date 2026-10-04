import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDismissOnOutsidePointer } from './useDismissOnOutsidePointer';

/** Campo con su menú flotante (en otro lugar del documento, como un portal). */
function Field({ open, onDismiss, single = false }: { open: boolean; onDismiss: () => void; single?: boolean }) {
  const field = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useDismissOnOutsidePointer(single ? field : [field, menu], open, onDismiss);
  return (
    <>
      <button ref={field} type="button">
        Campo
      </button>
      <div ref={menu}>Menú</div>
      <p>Afuera</p>
    </>
  );
}

describe('useDismissOnOutsidePointer', () => {
  it('abierto: tocar fuera cierra; tocar el campo o su menú no', () => {
    const onDismiss = vi.fn();
    render(<Field open onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText('Campo'));
    fireEvent.pointerDown(screen.getByText('Menú'));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('Afuera'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('con un solo elemento, todo lo demás cuenta como fuera', () => {
    const onDismiss = vi.fn();
    render(<Field open single onDismiss={onDismiss} />);
    fireEvent.pointerDown(screen.getByText('Campo'));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText('Menú'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('cerrado no escucha; al cerrarse deja de escuchar y usa siempre el manejador más reciente', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<Field open={false} onDismiss={first} />);
    fireEvent.pointerDown(screen.getByText('Afuera'));
    expect(first).not.toHaveBeenCalled();
    rerender(<Field open onDismiss={first} />);
    rerender(<Field open onDismiss={latest} />);
    fireEvent.pointerDown(screen.getByText('Afuera'));
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    rerender(<Field open={false} onDismiss={latest} />);
    fireEvent.pointerDown(screen.getByText('Afuera'));
    expect(latest).toHaveBeenCalledOnce();
  });
});
