import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../../context/FeedbackContext';
import { useSearchList, type ListQuery } from '../../hooks/useSearchList';
import { setLocale } from '../../i18n/core';
import { ApiError } from '../../services/apiClient';
import { renderWithProviders } from '../../test/render';
import { formatDateTime } from '../../utils/format';
import { DeletedMark } from '../ui/DeletedMark';
import { ListToolbar } from '../ui/ListControls';
import { DeletedBanner, DeletedNote, deletedText, deleteNote, listEmpty, listSubtitle, noMatchEmpty, RestoreButton, TrashCells, trashColumns } from './TrashParts';
import { useRestore } from './useRestore';

const DELETED_AT = '2026-10-05T16:00:00Z';
const record = { deleted_at: DELETED_AT, deleted_by: 'ana@empresa.com' };
const view = (changes: Partial<{ trash: boolean; appliedSearch: string; filtered: boolean }> = {}) => ({ trash: false, appliedSearch: '', filtered: false, ...changes });
const empty = { icon: <span />, title: 'Sin empleados', description: 'Registra al primer empleado para empezar.', compact: true };
const noMatch = noMatchEmpty('Sin resultados', 'Prueba con otra búsqueda o filtro.');

describe('Papelera («Eliminados»): reglas puras', () => {
  it('cuándo y quién lo eliminó (sin autor, solo la fecha), en los dos idiomas', async () => {
    const date = formatDateTime(DELETED_AT);
    expect(deletedText(record)).toBe(`Se eliminó el ${date} por ana@empresa.com`);
    expect(deletedText({ deleted_at: DELETED_AT, deleted_by: null })).toBe(`Se eliminó el ${date}`);
    await setLocale('en-US');
    expect(deletedText(record)).toBe(`Deleted ${formatDateTime(DELETED_AT)} by ana@empresa.com`);
    expect(deletedText({ deleted_at: DELETED_AT })).toBe(`Deleted ${formatDateTime(DELETED_AT)}`);
  });

  it('la nota al eliminar: va a «Eliminados»; a una persona, además, se le borran rostro y fotos', () => {
    expect(deleteNote()).toBe('Pasará a «Eliminados»: podrás restaurarlo durante 1 año.');
    expect(deleteNote({ person: true })).toBe('Pasará a «Eliminados»: podrás restaurarlo durante 1 año. Sus datos faciales y fotos se borran para siempre.');
    expect(deleteNote({ person: true, trash: 'Pasará a «Eliminadas».' })).toBe('Pasará a «Eliminadas». Sus datos faciales y fotos se borran para siempre.');
    expect(trashColumns()).toEqual(['Eliminación', 'Acciones']);
  });

  it('el vacío de un listado: nada eliminado, sin coincidencias o el de la pantalla', () => {
    expect(listEmpty(view({ trash: true, filtered: true }), { empty, noMatch })).toMatchObject({ title: 'Nada eliminado', description: 'Lo que elimines se guarda aquí durante un año.', compact: true });
    expect(listEmpty(view({ trash: true, filtered: true, appliedSearch: 'ana' }), { empty, noMatch })).toBe(noMatch);
    expect(listEmpty(view({ trash: true, filtered: true, appliedSearch: 'ana' }), { empty })).toBe(empty);
    expect(listEmpty(view({ filtered: true }), { empty, noMatch })).toBe(noMatch);
    expect(listEmpty(view(), { empty, noMatch })).toBe(empty);
  });

  it('el subtítulo: cargando, lo vigente o cuántos hay en «Eliminados» (con su propia concordancia)', () => {
    const live = (count: number) => `${count} registrados`;
    expect(listSubtitle({ ...view(), data: null, total: 0 }, live)).toBe('Cargando…');
    expect(listSubtitle({ ...view(), data: {}, total: 12 }, live)).toBe('12 registrados');
    expect(listSubtitle({ ...view({ trash: true }), data: {}, total: 1 }, live)).toBe('1 eliminado');
    expect(listSubtitle({ ...view({ trash: true }), data: {}, total: 3 }, live)).toBe('3 eliminados');
    expect(listSubtitle({ ...view({ trash: true }), data: {}, total: 2 }, live, (count) => `${count} eliminadas`)).toBe('2 eliminadas');
  });
});

describe('Papelera («Eliminados»): piezas', () => {
  it('la marca de una referencia eliminada: solo si lo está, con su texto propio y en inglés', async () => {
    const { container, rerender } = render(<DeletedMark />);
    expect(container).toBeEmptyDOMElement();
    rerender(<DeletedMark deleted />);
    expect(screen.getByText('Eliminado')).toHaveClass('badge', 'badge--muted', 'deleted-mark');
    rerender(<DeletedMark deleted label="Eliminada" />);
    expect(screen.getByText('Eliminada')).toBeInTheDocument();
    await act(() => setLocale('en-US'));
    rerender(<DeletedMark deleted />);
    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });

  it('la nota de una tarjeta, las celdas de una tabla y «Restaurar» (ocupado y deshabilitado)', async () => {
    const onRestore = vi.fn();
    const { rerender } = render(
      <>
        <DeletedNote record={record} />
        <table>
          <tbody>
            <tr>
              <TrashCells record={record} name="Ana Ruiz" busy={false} onRestore={onRestore} />
            </tr>
          </tbody>
        </table>
      </>,
    );
    expect(screen.getAllByText(/Se eliminó el .* por ana@empresa\.com/)).toHaveLength(2);
    expect(screen.getByRole('cell', { name: /Se eliminó el/ })).toHaveAttribute('data-label', 'Eliminación');
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' }));
    expect(onRestore).toHaveBeenCalledOnce();

    rerender(<RestoreButton name="Ana Ruiz" busy onRestore={onRestore} />);
    expect(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' })).toBeDisabled();
    rerender(<RestoreButton name="Ana Ruiz" busy={false} disabled size="md" onRestore={onRestore} />);
    expect(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' })).toHaveClass('btn--primary');
    expect(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' })).toBeDisabled();
  });

  it('el aviso del detalle: qué es, cuándo y quién, y su acción; sigue al idioma', async () => {
    render(<DeletedBanner record={record} title="Empleado eliminado" action={<button type="button">Restaurar</button>} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('callout', 'callout--danger');
    expect(banner).toHaveTextContent(/Empleado eliminadoSe eliminó el .* por ana@empresa\.com/);
    await act(() => setLocale('en-US'));
    expect(banner).toHaveTextContent(/Deleted .* by ana@empresa\.com/);
  });

  it('ListToolbar: «Eliminados» es opcional; sin estados es «Todos» / «Eliminados»; sin búsqueda, solo el filtro', async () => {
    const onFilter = vi.fn();
    const { container, rerender } = render(<ListToolbar search="" onSearch={() => undefined} placeholder="Buscar" label="Buscar" filter="all" onFilter={onFilter} trash />);
    await userEvent.click(screen.getByRole('button', { name: /Filtrar por estado/ }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos los estados', 'Activos', 'Inactivos', 'Eliminados']);
    await userEvent.click(screen.getByRole('option', { name: 'Eliminados' }));
    expect(onFilter).toHaveBeenCalledWith('deleted');

    rerender(<ListToolbar filter="deleted" onFilter={onFilter} trash statuses={false} labels={{ deleted: 'Eliminadas' }} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(container.querySelector('.toolbar')).toHaveClass('toolbar--filter');
    const filter = screen.getByRole('button', { name: /Filtrar por estado/ });
    expect(filter).toHaveTextContent('Eliminadas');
    await userEvent.click(filter);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Todos', 'Eliminadas']);
  });
});

describe('useSearchList: el filtro como lo pide la API', () => {
  it('«Eliminados» envía deleted=true sin active; activos e inactivos, solo active', async () => {
    const fetchPage = vi.fn((_query: ListQuery, _signal: AbortSignal) => Promise.resolve({ items: [] as string[], total: 0, page: 1, size: 10 }));
    const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;
    const { result } = renderHook(() => useSearchList(fetchPage, { errorTitle: 'No cargó' }), { wrapper });
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(1));
    expect(fetchPage.mock.lastCall).toEqual([{ page: 1, size: 10 }, expect.any(AbortSignal)]);
    expect(result.current.trash).toBe(false);

    act(() => result.current.setFilter('deleted'));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(fetchPage.mock.lastCall?.[0]).toEqual({ page: 1, size: 10, deleted: true });
    expect(result.current.trash).toBe(true);
    expect(result.current.filtered).toBe(true);

    act(() => result.current.setFilter('active'));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3));
    expect(fetchPage.mock.lastCall?.[0]).toEqual({ page: 1, size: 10, active: true });
    act(() => result.current.setFilter('inactive'));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(4));
    expect(fetchPage.mock.lastCall?.[0]).toEqual({ page: 1, size: 10, active: false });
  });
});

/** Un botón que restaura con `useRestore` (como lo hacen los listados y los detalles). */
function RestoreHarness({ task, onRestored }: { task: () => Promise<{ item: { id: number; name: string }; message: string }>; onRestored: (item: { id: number; name: string }) => void }) {
  const { restoring, restore } = useRestore();
  return (
    <RestoreButton
      name="Ana Ruiz"
      busy={restoring === 7}
      onRestore={() => void restore(7, task, () => ({ title: '¿Restaurar a Ana Ruiz?', details: [{ label: 'Correo', value: 'ana@empresa.com' }], note: 'Deberá registrar su rostro de nuevo.' }), onRestored)}
    />
  );
}

describe('useRestore: pregunta antes, avisa con el mensaje del servidor y entrega el registro', () => {
  it('cancelar no envía nada; confirmar restaura, avisa y entrega el registro', async () => {
    const task = vi.fn(() => Promise.resolve({ item: { id: 7, name: 'Ana Ruiz' }, message: 'Empleado restaurado. Debe registrar su rostro de nuevo.' }));
    const onRestored = vi.fn();
    renderWithProviders(<RestoreHarness task={task} onRestored={onRestored} />);

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' }));
    let dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Ana Ruiz?' });
    expect(dialog).toHaveTextContent('Eliminados');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Correoana@empresa.com');
    expect(dialog.querySelector('.confirm-note')).toHaveTextContent('Deberá registrar su rostro de nuevo.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(task).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' }));
    dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Ana Ruiz?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('dialog', { name: 'Empleado restaurado. Debe registrar su rostro de nuevo.' })).toBeInTheDocument();
    expect(onRestored).toHaveBeenCalledWith({ id: 7, name: 'Ana Ruiz' });
  });

  it('si el servidor lo impide (algo ocupa ya su lugar), el popup dice por qué y nada cambia', async () => {
    const task = vi.fn(() => Promise.reject(new ApiError({ statusCode: 409, code: 'RESTORE_CONFLICT', message: 'Otro empleado ya usa ese correo.' })));
    const onRestored = vi.fn();
    renderWithProviders(<RestoreHarness task={task} onRestored={onRestored} />);
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar Ana Ruiz' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Restaurar a Ana Ruiz?' })).getByRole('button', { name: 'Restaurar' }));
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo restaurar' })).toHaveTextContent('Otro empleado ya usa ese correo.');
    expect(onRestored).not.toHaveBeenCalled();
  });

  it('en inglés: la confirmación y su botón', async () => {
    await setLocale('en-US');
    renderWithProviders(<RestoreHarness task={() => new Promise(() => undefined)} onRestored={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Restore Ana Ruiz' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Restaurar a Ana Ruiz?' });
    expect(within(dialog).getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore Ana Ruiz' })).toBeDisabled());
  });
});
