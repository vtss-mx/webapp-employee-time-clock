import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { PeriodNavigator } from './PeriodNavigator';

const YEARS = { from: 2000, to: 2100 };

/** El navegador controlado por una pantalla (el periodo vive afuera). */
function Harness({ start = [2026, 9] as [number, number], onToday = vi.fn(), unlimited = false }) {
  const [[year, month], setView] = useState(start);
  return (
    <>
      <PeriodNavigator year={year} month={month} today="2026-10-05" years={unlimited ? undefined : YEARS} onChange={(nextYear, nextMonth) => setView([nextYear, nextMonth])} onToday={onToday} />
      <button type="button">Afuera</button>
    </>
  );
}

/** El título del periodo (abre el selector). */
const title = () => document.querySelector('.cal-period__title') as HTMLButtonElement;
const picker = () => screen.getByRole('dialog', { name: 'Elegir mes' });

describe('PeriodNavigator', () => {
  it('Hoy, mes anterior y siguiente (con cambio de año) y el mes anunciado', async () => {
    const onToday = vi.fn();
    render(<Harness start={[2026, 11]} onToday={onToday} />);
    expect(title()).toHaveAccessibleName('Diciembre 2026');
    expect(title()).toHaveAttribute('title', 'Elegir otro mes');
    expect(title()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(title()).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('Diciembre de 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    expect(title()).toHaveAccessibleName('Enero 2027');
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    await userEvent.click(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(title()).toHaveAccessibleName('Noviembre 2026');
    await userEvent.click(screen.getByRole('button', { name: 'Hoy' }));
    expect(onToday).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute('title', 'Ir a hoy');
  });

  it('respeta los años del backend; sin límites, todo está disponible', () => {
    const { unmount } = render(<Harness start={[2100, 11]} />);
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();
    unmount();
    const first = render(<Harness start={[2000, 0]} />);
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mes siguiente' })).toBeEnabled();
    first.unmount();
    render(<Harness start={[2000, 0]} unlimited />);
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeEnabled();
  });

  it('el título abre el selector de mes y año: elige otro mes de otro año y regresa el foco', async () => {
    render(<Harness />);
    await userEvent.click(title());
    expect(title()).toHaveAttribute('aria-expanded', 'true');
    const months = within(picker()).getByRole('group', { name: 'Meses de 2026' });
    expect(within(months).getAllByRole('button')).toHaveLength(12);
    // El mes que se ve está elegido y tiene el foco; el de hoy está marcado.
    const october = within(months).getByRole('button', { name: 'Octubre de 2026' });
    expect(october).toHaveAttribute('aria-pressed', 'true');
    expect(october).toHaveAttribute('aria-current', 'date');
    expect(october).toHaveTextContent('Oct');
    expect(october).toHaveFocus();
    // Flechas entre meses (tres columnas).
    await userEvent.keyboard('{ArrowUp}');
    expect(within(months).getByRole('button', { name: 'Julio de 2026' })).toHaveFocus();
    // Otro año: el anterior y el siguiente; en él ningún mes está elegido ni es el de hoy.
    await userEvent.click(within(picker()).getByRole('button', { name: 'Año siguiente' }));
    const next = within(picker()).getByRole('group', { name: 'Meses de 2027' });
    expect(within(next).getByRole('button', { name: 'Octubre de 2027' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(next).getByRole('button', { name: 'Octubre de 2027' })).not.toHaveAttribute('aria-current');
    await userEvent.click(within(picker()).getByRole('button', { name: 'Año anterior' }));
    await userEvent.click(within(picker()).getByRole('button', { name: 'Año anterior' }));
    await userEvent.click(within(picker()).getByRole('button', { name: 'Marzo de 2025' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(title()).toHaveAccessibleName('Marzo 2025');
    expect(title()).toHaveFocus();
    expect(title()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape cierra y regresa el foco; tocar fuera cierra sin moverlo; el título también lo cierra', async () => {
    render(<Harness />);
    await userEvent.click(title());
    fireEvent.keyDown(within(picker()).getByRole('button', { name: 'Octubre de 2026' }), { key: 'a' });
    expect(picker()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(title()).toHaveFocus();

    await userEvent.click(title());
    await userEvent.click(screen.getByRole('button', { name: 'Afuera' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Afuera' })).toHaveFocus();

    await userEvent.click(title());
    expect(picker()).toBeInTheDocument();
    await userEvent.click(title());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('en los límites del backend no pasa de año; sin límites, sí', async () => {
    const { unmount } = render(<Harness start={[2100, 5]} />);
    await userEvent.click(title());
    expect(within(picker()).getByRole('button', { name: 'Año siguiente' })).toBeDisabled();
    expect(within(picker()).getByRole('button', { name: 'Año anterior' })).toBeEnabled();
    unmount();
    const first = render(<Harness start={[2000, 5]} />);
    await userEvent.click(title());
    expect(within(picker()).getByRole('button', { name: 'Año anterior' })).toBeDisabled();
    first.unmount();
    render(<Harness start={[2000, 5]} unlimited />);
    await userEvent.click(title());
    expect(within(picker()).getByRole('button', { name: 'Año anterior' })).toBeEnabled();
  });

  it('en inglés: "Today", el mes y el selector siguen el idioma en caliente', async () => {
    render(<Harness />);
    await userEvent.click(title());
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(title()).toHaveAccessibleName('October 2026');
    const dialog = screen.getByRole('dialog', { name: 'Choose a month' });
    expect(within(dialog).getByRole('button', { name: 'October 2026' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Next year' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Months of 2026' })).toBeInTheDocument();
  });
});
