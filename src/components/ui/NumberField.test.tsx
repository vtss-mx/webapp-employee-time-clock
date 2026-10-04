import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clampNumber, digitsOf, NumberField, steppedValue, type NumberFieldProps } from './NumberField';

type HarnessProps = Partial<Omit<NumberFieldProps, 'value' | 'onChange'>> & { initial?: string };

function Harness({ initial = '', ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumberField label="Minutos de descanso" value={value} onChange={setValue} {...props} />
      <output>{value}</output>
    </>
  );
}

const field = () => screen.getByRole('spinbutton', { name: 'Minutos de descanso' });
const output = () => document.querySelector('output')?.textContent;
const plus = () => screen.getByRole('button', { name: 'Aumentar' });
const minus = () => screen.getByRole('button', { name: 'Disminuir' });

afterEach(() => vi.useRealTimers());

/** Avanza el reloj simulado (mantener presionado un botón). */
function elapse(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('utilidades del número', () => {
  it('solo dígitos (los que caben en el máximo), límites y pasos', () => {
    expect(digitsOf('1,500 m')).toBe('1500');
    expect(digitsOf('123456', 999)).toBe('123');
    expect(digitsOf('9'.repeat(20))).toHaveLength(15);
    expect(clampNumber(300, { min: 5, max: 240, step: 1 })).toBe(240);
    expect(clampNumber(2, { min: 5, step: 1 })).toBe(5);
    expect(clampNumber(9000, { min: 5, step: 1 })).toBe(9000);
    expect(steppedValue('', 1, { min: 5, max: 240, step: 5 })).toBe('5'); // desde vacío, el mínimo
    expect(steppedValue('10', -1, { min: 5, max: 240, step: 5 })).toBe('5');
    expect(steppedValue('238', 10, { min: 5, max: 240, step: 1 })).toBe('240');
  });
});

describe('NumberField', () => {
  it('campo de texto con teclado numérico (sin flechas nativas): solo acepta dígitos y muestra la unidad', async () => {
    render(<Harness unit="min" hint="Entre 5 y 240" max={240} />);
    expect(field()).toHaveAttribute('type', 'text');
    expect(field()).toHaveAttribute('inputmode', 'numeric');
    expect(field()).toHaveAccessibleDescription('Entre 5 y 240');
    expect(field()).not.toHaveAttribute('aria-valuenow');
    expect(field()).not.toHaveAttribute('aria-valuetext');
    await userEvent.type(field(), 'a1b2c34');
    expect(field()).toHaveValue('123'); // el máximo tiene 3 dígitos
    expect(field()).toHaveAttribute('aria-valuenow', '123');
    expect(field()).toHaveAttribute('aria-valuetext', '123 min');
    expect(field()).toHaveAttribute('aria-valuemin', '0');
    expect(field()).toHaveAttribute('aria-valuemax', '240');
    const affix = document.querySelector('.number-field__affix') as HTMLElement;
    expect(affix).toHaveAttribute('aria-hidden');
    expect(affix).toHaveTextContent('123min'); // copia invisible del número + unidad
  });

  it('botones − y + suman el paso, se deshabilitan en los límites; desde vacío empiezan en el mínimo', async () => {
    render(<Harness min={5} max={20} step={5} />);
    expect(document.querySelector('.number-field__affix')).toBeNull(); // sin unidad
    await userEvent.click(plus());
    expect(output()).toBe('5');
    expect(minus()).toBeDisabled();
    await userEvent.click(plus());
    await userEvent.click(plus());
    await userEvent.click(plus());
    expect(output()).toBe('20');
    expect(plus()).toBeDisabled();
    await userEvent.click(minus());
    expect(output()).toBe('15');
    expect(plus()).not.toHaveAttribute('tabindex', '0'); // con teclado se usan las flechas del campo
    expect(plus()).toHaveAttribute('aria-controls', field().id);
    expect(fireEvent.mouseDown(plus())).toBe(false); // el foco se queda en el campo
  });

  it('flechas ↑/↓ un paso, Re Pág/Av Pág diez pasos; las demás teclas escriben', async () => {
    render(<Harness initial="50" max={240} />);
    field().focus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(output()).toBe('52');
    await userEvent.keyboard('{ArrowDown}');
    expect(output()).toBe('51');
    await userEvent.keyboard('{PageUp}');
    expect(output()).toBe('61');
    await userEvent.keyboard('{PageDown}{PageDown}');
    expect(output()).toBe('41');
    await userEvent.keyboard('{End}0');
    expect(output()).toBe('410');
  });

  it('al salir ajusta a los límites y quita ceros a la izquierda; vacío se queda vacío; se puede desactivar', async () => {
    const onBlur = vi.fn();
    const { unmount } = render(<Harness min={5} max={240} onBlur={onBlur} />);
    await userEvent.type(field(), '999');
    await userEvent.tab();
    expect(output()).toBe('240');
    await userEvent.clear(field());
    await userEvent.type(field(), '2');
    await userEvent.tab();
    expect(output()).toBe('5');
    await userEvent.clear(field());
    await userEvent.type(field(), '007');
    await userEvent.tab();
    expect(output()).toBe('7');
    await userEvent.click(field());
    await userEvent.tab(); // dentro de los límites: no cambia
    expect(output()).toBe('7');
    await userEvent.clear(field());
    await userEvent.tab();
    expect(output()).toBe('');
    expect(onBlur).toHaveBeenCalledTimes(5);
    unmount();

    render(<Harness min={5} clampOnBlur={false} />);
    await userEvent.type(field(), '2');
    await userEvent.tab();
    expect(output()).toBe('2');
  });

  it('mantener presionado repite el paso hasta soltar; un toque corto es un solo paso', () => {
    vi.useFakeTimers();
    render(<Harness initial="10" max={14} />);
    fireEvent.pointerDown(plus(), { button: 0 });
    elapse(449);
    expect(output()).toBe('10');
    elapse(1);
    expect(output()).toBe('11');
    elapse(150);
    expect(output()).toBe('13');
    fireEvent.pointerUp(window);
    fireEvent.click(plus()); // el clic al soltar no suma otra vez
    elapse(500);
    expect(output()).toBe('13');

    fireEvent.pointerDown(plus(), { button: 0 });
    fireEvent.pointerUp(window);
    fireEvent.click(plus()); // toque corto
    expect(output()).toBe('14');

    fireEvent.pointerDown(minus(), { button: 0 });
    elapse(450);
    fireEvent.pointerLeave(minus()); // salir del botón también detiene
    elapse(500);
    expect(output()).toBe('13');
    fireEvent.pointerCancel(window);

    fireEvent.pointerDown(minus(), { button: 2 }); // botón secundario: nada
    elapse(1000);
    expect(output()).toBe('13');
  });

  it('al llegar al límite deja de repetir; sin repetición solo cuenta el clic', () => {
    vi.useFakeTimers();
    const { unmount } = render(<Harness initial="1" min={0} />);
    fireEvent.pointerDown(minus(), { button: 0 });
    elapse(450 + 75 * 5);
    expect(output()).toBe('0');
    expect(minus()).toBeDisabled();
    fireEvent.pointerDown(plus(), { button: 0 });
    unmount(); // desmontar con el botón presionado no deja temporizadores

    render(<Harness initial="1" holdToRepeat={false} />);
    fireEvent.pointerDown(plus(), { button: 0 });
    elapse(1000);
    expect(output()).toBe('1');
    fireEvent.click(plus());
    expect(output()).toBe('2');
  });

  it('error, deshabilitado y personalizable (ícono, textos, tamaño, nombre)', () => {
    render(<Harness initial="3" icon={<span>⏱</span>} error="Entre 5 y 240 min" disabled size="sm" name="break" placeholder="0" required labels={{ increment: 'Más', decrement: 'Menos' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Entre 5 y 240 min');
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).toBeDisabled();
    expect(field()).toBeRequired();
    expect(field()).toHaveAttribute('name', 'break');
    expect(field()).toHaveAttribute('placeholder', '0');
    expect(screen.getByRole('button', { name: 'Más' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Menos' })).toBeDisabled();
    expect(field().closest('.field')).toHaveClass('number-field', 'field--with-icon', 'field--sm', 'field--error');
  });
});
