import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { clampToRange, clockDisplay, clockText, clockValue, completeClock, maskClock, minuteOptions, overlapsRange, parseClock } from './clock';
import { TimeField, type TimeFieldProps } from './TimeField';

type HarnessProps = Partial<Omit<TimeFieldProps, 'value' | 'onChange'>> & { initial?: string };

function Harness({ initial = '', ...props }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TimeField label="Hora de entrada" value={value} onChange={setValue} {...props} />
      <output>{value}</output>
      <button type="button" onClick={() => setValue('16:00:00')}>
        externo
      </button>
    </>
  );
}

const input = () => screen.getByLabelText('Hora de entrada');
const output = () => document.querySelector('output')?.textContent;
const toggle = () => screen.getByRole('button', { name: 'Elegir hora' });
const hours = () => screen.getByRole('listbox', { name: 'Hora' });
const minutes = () => screen.getByRole('listbox', { name: 'Min' });
const activeOf = (list: HTMLElement) => document.getElementById(list.getAttribute('aria-activedescendant') as string);
async function openPanel() {
  await userEvent.click(toggle());
  const dialog = screen.getByRole('dialog', { name: 'Elegir hora' });
  await waitFor(() => expect(hours()).toHaveFocus()); // el foco entra en el siguiente cuadro
  return dialog;
}

describe('utilidades de la hora', () => {
  it('lee, escribe, enmascara y completa "HH:MM"', () => {
    expect(parseClock('08:30')).toBe(510);
    expect(parseClock('23:59:00')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('7:30')).toBeNull();
    expect(parseClock(undefined)).toBeNull();
    expect(clockText(450)).toBe('07:30');
    expect(maskClock('0730')).toBe('07:30');
    expect(maskClock('07:30:00')).toBe('07:30');
    expect(maskClock('7a')).toBe('7');
    expect(clockValue('07:3')).toBe('');
    expect(clockValue('25:00')).toBe('25:00'); // completa pero inexistente → la validación la marca
    expect(clockDisplay('08:00:00')).toBe('08:00');
    expect(clockDisplay('')).toBe('');
    expect(completeClock('7')).toBe('07:00');
    expect(completeClock('14')).toBe('14:00');
    expect(completeClock('73:0')).toBe('07:30');
    expect(completeClock('')).toBe('');
    expect(completeClock('07:30')).toBe('07:30');
  });

  it('rango y minutos del selector (con el paso y la hora exacta)', () => {
    const range = { min: 480, max: 1020 };
    expect(overlapsRange(420, 479, range)).toBe(false);
    expect(overlapsRange(420, 480, range)).toBe(true);
    expect(overlapsRange(0, 1439, { min: null, max: null })).toBe(true);
    expect(clampToRange(1100, range)).toBe(1020);
    expect(clampToRange(10, { min: null, max: null })).toBe(10);
    expect(clampToRange(10, { min: 480, max: null })).toBe(480);
    expect(clampToRange(1200, { min: null, max: 1020 })).toBe(1020);
    expect(minuteOptions(15, [null, 7, 30])).toEqual([0, 7, 15, 30, 45]);
    expect(minuteOptions(0, [])).toHaveLength(60);
    expect(minuteOptions(90, [])).toEqual([0]);
  });
});

describe('TimeField: escribir', () => {
  it('máscara HH:MM con teclado numérico; incompleta entrega ""; al salir completa lo escrito', async () => {
    const onBlur = vi.fn();
    render(<Harness onBlur={onBlur} hint="Hora del negocio" />);
    expect(input()).toHaveAttribute('type', 'text');
    expect(input()).toHaveAttribute('inputmode', 'numeric');
    expect(input()).toHaveAttribute('placeholder', 'hh:mm');
    expect(input()).toHaveAccessibleDescription('Hora del negocio');
    await userEvent.type(input(), '073');
    expect(input()).toHaveValue('07:3');
    expect(output()).toBe('');
    await userEvent.type(input(), '0');
    expect(output()).toBe('07:30');
    await userEvent.clear(input());
    await userEvent.type(input(), '7');
    await userEvent.tab();
    expect(input()).toHaveValue('07:00');
    expect(output()).toBe('07:00');
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('una hora que no existe o fuera de los límites se explica en el campo (antes que el error del formulario)', async () => {
    const { unmount } = render(<Harness error="Indica la hora" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Indica la hora');
    await userEvent.type(input(), '2560');
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe una hora entre 00:00 y 23:59');
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(output()).toBe('25:60');
    unmount();

    const { unmount: unmountMin } = render(<Harness min="07:00" />);
    await userEvent.type(input(), '0630');
    expect(screen.getByRole('alert')).toHaveTextContent('Elige una hora entre 07:00 y 23:59');
    unmountMin();
    render(<Harness max="18:00" labels={{ outOfRange: (min, max) => `De ${min} a ${max}` }} />);
    await userEvent.type(input(), '1900');
    expect(screen.getByRole('alert')).toHaveTextContent('De 00:00 a 18:00');
    await userEvent.clear(input());
    await userEvent.type(input(), '1800');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('se sincroniza con el valor externo (también "HH:MM:SS" de la API) y se deshabilita', async () => {
    const { rerender } = render(<Harness initial="08:00" />);
    expect(input()).toHaveValue('08:00');
    await userEvent.click(screen.getByRole('button', { name: 'externo' }));
    expect(input()).toHaveValue('16:00');
    rerender(<Harness initial="08:00" disabled />);
    expect(input()).toBeDisabled();
    expect(toggle()).toBeDisabled();
  });

  it('personalizable: textos, sin ícono, ícono del botón y tamaño compacto', () => {
    render(<Harness icon={null} toggleIcon={<span>reloj</span>} size="sm" labels={{ open: 'Abrir reloj', placeholder: '--:--' }} name="start" required />);
    const field = input().closest('.field') as HTMLElement;
    expect(field).toHaveClass('time-field', 'field--sm');
    expect(field).not.toHaveClass('field--with-icon');
    expect(field.querySelector('.field__icon')).toBeNull();
    expect(screen.getByRole('button', { name: 'Abrir reloj' })).toHaveTextContent('reloj');
    expect(input()).toHaveAttribute('placeholder', '--:--');
    expect(input()).toHaveAttribute('name', 'start');
    expect(input()).toBeRequired();
  });
});

describe('TimeField: selector propio', () => {
  it('con el ratón: la hora elegida resaltada, elegir la hora pasa a los minutos y elegir los minutos cierra', async () => {
    render(<Harness initial="08:30" />);
    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    const dialog = await openPanel();
    expect(dialog.closest('.floating')?.parentElement).toBe(document.body); // capa flotante (ningún panel la recorta)
    expect(dialog.querySelector('select, input')).toBeNull(); // nada nativo
    expect(within(dialog).getByText('08:30')).toBeInTheDocument(); // lectura grande
    expect(within(hours()).getByRole('option', { name: '08' })).toHaveAttribute('aria-selected', 'true');
    expect(within(minutes()).getByRole('option', { name: '30' })).toHaveClass('is-selected');
    expect(within(minutes()).getAllByRole('option')).toHaveLength(12); // cada 5 minutos

    await userEvent.click(within(hours()).getByRole('option', { name: '09' }));
    expect(output()).toBe('09:30'); // conserva los minutos
    expect(minutes()).toHaveFocus();
    await userEvent.click(within(minutes()).getByRole('option', { name: '45' }));
    expect(output()).toBe('09:45');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus(); // regresa el foco al botón

    await userEvent.click(toggle());
    await userEvent.click(toggle()); // el mismo botón lo cierra
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con el teclado: flechas, Inicio/Fin, dígitos, cambiar de columna, Enter, Espacio y Escape', async () => {
    const onParentKey = vi.fn();
    render(
      <div onKeyDown={onParentKey}>
        <Harness initial="08:30" />
      </div>,
    );
    input().focus();
    await userEvent.keyboard('{ArrowDown}'); // abre el selector
    await waitFor(() => expect(hours()).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(activeOf(hours())).toHaveTextContent('10');
    await userEvent.keyboard('{End}');
    expect(activeOf(hours())).toHaveTextContent('23');
    await userEvent.keyboard('{Home}1');
    expect(activeOf(hours())).toHaveTextContent('10'); // el dígito salta a la siguiente que empieza con él
    await userEvent.keyboard('x{Shift}'); // sin coincidencia: nada cambia
    expect(activeOf(hours())).toHaveTextContent('10');
    await userEvent.keyboard('{Enter}');
    expect(output()).toBe('10:30');
    expect(minutes()).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(hours()).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    expect(activeOf(minutes())).toHaveTextContent('25');
    await userEvent.keyboard(' ');
    expect(output()).toBe('10:25');
    expect(screen.queryByRole('dialog')).toBeNull();

    await userEvent.click(toggle());
    await waitFor(() => expect(hours()).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus();
    expect(onParentKey).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' })); // no cierra la ventana que lo contiene
  });

  it('Escape en el campo cierra el selector sin llegar a la ventana que lo contiene; cerrado, Escape sigue su curso', async () => {
    const keys: string[] = [];
    render(
      <div onKeyDown={(e) => keys.push(e.key)}>
        <Harness initial="08:30" />
      </div>,
    );
    await openPanel();
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(keys).toEqual([]);
    fireEvent.keyDown(input(), { key: 'Escape' });
    fireEvent.keyDown(input(), { key: 'a' });
    expect(keys).toEqual(['Escape', 'a']);
  });

  it('salir con Tab (o Mayús+Tab desde el primero) cierra; dentro del selector Tab recorre', async () => {
    render(<Harness initial="08:30" presets={['07:00']} />);
    const dialog = await openPanel();
    fireEvent.keyDown(hours(), { key: 'Tab' }); // a los minutos: sigue abierto
    expect(screen.getByRole('dialog')).toBe(dialog);
    fireEvent.keyDown(minutes(), { key: 'Tab' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle()).toHaveFocus();

    await openPanel();
    fireEvent.keyDown(screen.getByRole('button', { name: '07:00' }), { key: 'Tab', shiftKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('tocar fuera cierra sin mover el foco; tocar el campo no lo cierra', async () => {
    render(<Harness initial="08:30" />);
    await openPanel();
    fireEvent.pointerDown(input());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('horas sugeridas (con texto propio, inválidas ignoradas, fuera del rango deshabilitadas)', async () => {
    render(<Harness initial="08:00" min="06:00" max="20:00" presets={['08:00', { value: '12:00', label: 'Mediodía' }, '05:00', 'tarde']} />);
    await openPanel();
    const presets = screen.getByRole('group', { name: 'Horas sugeridas' });
    expect(within(presets).getAllByRole('button')).toHaveLength(3);
    expect(within(presets).getByRole('button', { name: '08:00' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(presets).getByRole('button', { name: '05:00' })).toBeDisabled();
    await userEvent.click(within(presets).getByRole('button', { name: 'Mediodía' }));
    expect(output()).toBe('12:00');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('límites: horas y minutos fuera del rango deshabilitados; al cambiar de hora los minutos se ajustan', async () => {
    render(<Harness min="07:58" max="18:10" />);
    await openPanel();
    expect(within(hours()).getByRole('option', { name: '06' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(hours()).getByRole('option', { name: '07' })).not.toHaveAttribute('aria-disabled');
    expect(activeOf(hours())).toHaveTextContent('07'); // sin hora abre en el mínimo
    expect(within(minutes()).getByRole('option', { name: '58' })).toBeInTheDocument();
    await userEvent.click(within(hours()).getByRole('option', { name: '06' })); // deshabilitada: nada
    expect(output()).toBe('');
    await userEvent.click(within(hours()).getByRole('option', { name: '07' }));
    expect(output()).toBe('07:58');
    await userEvent.click(within(minutes()).getByRole('option', { name: '30' })); // 07:30 queda antes del mínimo
    expect(output()).toBe('07:58');
    await userEvent.click(within(hours()).getByRole('option', { name: '18' }));
    expect(output()).toBe('18:10'); // 18:58 → el máximo
    expect(within(minutes()).getByRole('option', { name: '15' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('sin hora: abre donde se indica; elegir solo los minutos usa la hora activa; la hora exacta siempre aparece', async () => {
    render(<Harness openTo="07:30" minuteStep={15} />);
    let dialog = await openPanel();
    expect(within(dialog).getByText('--:--')).toBeInTheDocument();
    expect(within(hours()).queryByRole('option', { selected: true })).toBeNull();
    expect(within(minutes()).getAllByRole('option').map((o) => o.textContent)).toEqual(['00', '15', '30', '45']);
    await userEvent.click(within(minutes()).getByRole('option', { name: '45' }));
    expect(output()).toBe('07:45');

    await userEvent.clear(input());
    await userEvent.type(input(), '0733');
    dialog = await openPanel();
    expect(within(minutes()).getAllByRole('option').map((o) => o.textContent)).toEqual(['00', '15', '30', '33', '45']);
    await userEvent.clear(input()); // borrar con el selector abierto: conserva dónde estaba
    expect(within(dialog).getByText('--:--')).toBeInTheDocument();
    expect(activeOf(hours())).toHaveTextContent('07');
    await userEvent.click(within(hours()).getByRole('option', { name: '09' }));
    expect(output()).toBe('09:33');
  });

  it('centra la opción activa moviendo solo la lista', async () => {
    const box = (prop: 'offsetTop' | 'offsetHeight' | 'clientHeight', get: (el: HTMLElement) => number) =>
      vi.spyOn(HTMLElement.prototype, prop, 'get').mockImplementation(function (this: HTMLElement) {
        return get(this);
      });
    box('offsetTop', (el) => Number(el.id.split('-').pop()) * 40);
    box('offsetHeight', () => 40);
    box('clientHeight', () => 200);
    render(<Harness initial="10:30" />);
    await openPanel();
    expect(hours().scrollTop).toBe(320); // 10 × 40 − (200 − 40) / 2
    expect(minutes().scrollTop).toBe(160);
  });
});
