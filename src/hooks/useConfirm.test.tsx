import { act, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash } from 'lucide-react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../components/Modal';
import { ConfirmContext, ConfirmProvider } from '../context/ConfirmContext';
import { FeedbackProvider } from '../context/FeedbackContext';
import type { ConfirmInput } from '../types/confirm';
import { useConfirm } from './useConfirm';

const wrapper = ({ children }: { children: ReactNode }) => <FeedbackProvider>{children}</FeedbackProvider>;

/** Abre una confirmación desde el hook y devuelve su promesa. */
function ask(confirm: (input: ConfirmInput) => Promise<boolean>, input: ConfirmInput) {
  let done: Promise<boolean> = Promise.resolve(false);
  act(() => {
    done = confirm(input);
  });
  return done;
}

describe('useConfirm', () => {
  it('se resuelve true al confirmar y false al cancelar (botón, X o Escape)', async () => {
    const { result } = renderHook(() => useConfirm(), { wrapper });
    const confirmed = ask(result.current, { kind: 'delete', title: '¿Eliminar a Ana?' });
    const remove = await screen.findByRole('alertdialog', { name: '¿Eliminar a Ana?' });
    expect(within(remove).getByRole('button', { name: 'Cancelar' })).toHaveFocus(); // lo seguro primero
    await userEvent.click(within(remove).getByRole('button', { name: 'Eliminar' }));
    await expect(confirmed).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();

    const cancelled = ask(result.current, { title: '¿Seguro?' });
    const plain = await screen.findByRole('dialog', { name: '¿Seguro?' });
    expect(within(plain).getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    await userEvent.click(within(plain).getByRole('button', { name: 'Cancelar' }));
    await expect(cancelled).resolves.toBe(false);

    const closed = ask(result.current, { title: '¿Otra vez?' });
    await userEvent.click(within(await screen.findByRole('dialog', { name: '¿Otra vez?' })).getByRole('button', { name: 'Cerrar' }));
    await expect(closed).resolves.toBe(false);

    const escaped = ask(result.current, { title: '¿Y con Escape?' });
    await screen.findByRole('dialog', { name: '¿Y con Escape?' });
    await userEvent.keyboard('{Escape}');
    await expect(escaped).resolves.toBe(false);
  });

  it('varias seguidas: una a la vez y en orden, cada una con su respuesta', async () => {
    const { result } = renderHook(() => useConfirm(), { wrapper });
    const first = ask(result.current, { title: 'Primera' });
    const second = ask(result.current, { title: 'Segunda' });
    expect(await screen.findByRole('dialog', { name: 'Primera' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Segunda' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await expect(first).resolves.toBe(true);
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Segunda' })).getByRole('button', { name: 'Cancelar' }));
    await expect(second).resolves.toBe(false);
  });

  it('una edición sin cambios no pregunta: avisa "Sin cambios" y no se confirma', async () => {
    const { result } = renderHook(() => useConfirm(), { wrapper });
    await expect(ask(result.current, { kind: 'edit', title: '¿Guardar?', changes: [] })).resolves.toBe(false);
    expect(await screen.findByRole('dialog', { name: 'Sin cambios' })).toHaveTextContent('No hay nada que guardar');
    expect(screen.queryByRole('dialog', { name: '¿Guardar?' })).toBeNull();
  });

  it('si la pantalla que preguntó se cierra con el popup abierto, se retira y resuelve false', async () => {
    // El proveedor sigue montado; solo la pantalla que preguntó se va.
    function Screen({ onAsk }: { onAsk: (confirm: (input: ConfirmInput) => Promise<boolean>) => void }) {
      onAsk(useConfirm());
      return null;
    }
    let confirm: (input: ConfirmInput) => Promise<boolean> = () => Promise.resolve(true);
    const view = render(
      <FeedbackProvider>
        <Screen onAsk={(c) => (confirm = c)} />
      </FeedbackProvider>,
    );
    const pending = ask(confirm, { title: '¿Salir?' });
    expect(await screen.findByRole('dialog', { name: '¿Salir?' })).toBeInTheDocument();
    view.rerender(<FeedbackProvider>{null}</FeedbackProvider>);
    await expect(pending).resolves.toBe(false);
    expect(screen.queryByRole('dialog', { name: '¿Salir?' })).toBeNull();
  });

  it('si se desmonta la app con confirmaciones abiertas, ninguna se queda esperando', async () => {
    let api: Parameters<typeof ConfirmContext.Provider>[0]['value'] = null;
    const view = render(
      <ConfirmProvider notify={vi.fn()}>
        <ConfirmContext.Consumer>{(value) => ((api = value), null)}</ConfirmContext.Consumer>
      </ConfirmProvider>,
    );
    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => {
      pending = api!.ask({ title: '¿Seguro?' }).done;
    });
    expect(screen.getByRole('dialog', { name: '¿Seguro?' })).toBeInTheDocument();
    api!.cancel(999); // una que ya no existe: no pasa nada
    view.unmount();
    await expect(pending).resolves.toBe(false);
  });

  it('fuera del proveedor avisa con un error claro', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useConfirm())).toThrow('useConfirm debe usarse dentro de <FeedbackProvider>');
  });
});

describe('ConfirmDialog: personalización', () => {
  const noop = () => undefined;

  it('crear: azul, "Nuevo registro" y "Crear"; lo que se crea en filas y líneas', () => {
    render(
      <ConfirmDialog
        open
        kind="create"
        title="¿Registrar a Ana Ruiz?"
        message="Podrá iniciar sesión con su correo."
        detailsTitle="Se registrará"
        details={[{ label: 'Correo', value: 'ana@empresa.com' }, 'Se generará su código QR.']}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: '¿Registrar a Ana Ruiz?' });
    expect(dialog).toHaveClass('msg--info', 'msg--confirm');
    expect(dialog).toHaveAccessibleDescription('Podrá iniciar sesión con su correo.');
    expect(within(dialog).getByText('Nuevo registro')).toBeInTheDocument();
    const facts = within(dialog).getByRole('region', { name: 'Se registrará' });
    expect(within(facts).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Correoana@empresa.com', 'Se generará su código QR.']);
    expect(within(dialog).getByRole('button', { name: 'Crear' })).toHaveClass('btn--primary');
  });

  it('editar: los cambios "antes → después" con su cuenta; sin texto ni detalles no hay descripción', () => {
    const { rerender } = render(
      <ConfirmDialog
        open
        kind="edit"
        title="¿Guardar los cambios?"
        changes={[
          { label: 'Nombre', before: 'Ana', after: 'Anita' },
          { label: 'Teléfono', before: 'Sin capturar', after: '662 123 4567' },
        ]}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: '¿Guardar los cambios?' });
    expect(dialog).not.toHaveAttribute('aria-describedby');
    expect(within(dialog).getByText('Confirmar cambios')).toBeInTheDocument();
    const changes = within(dialog).getByRole('region', { name: 'Cambios' });
    expect(changes).toHaveTextContent('2 cambios');
    expect(within(changes).getAllByRole('listitem')[0]).toHaveTextContent('NombreAntes: AnaDespués: Anita');
    expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
    rerender(<ConfirmDialog open kind="edit" title="¿Guardar?" changes={[{ label: 'Nombre', before: 'Ana', after: 'Anita' }]} details={[]} onConfirm={noop} onCancel={noop} />);
    expect(screen.getByRole('region', { name: 'Cambios' })).toHaveTextContent('1 cambio');
    expect(screen.queryByRole('region', { name: 'Detalles' })).toBeNull();
  });

  it('eliminar: alerta roja, consecuencia resaltada y texto para habilitarla', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open kind="delete" title="¿Eliminar Acme?" note="No se puede deshacer." confirmText="Acme" details={['Sus validadores']} onConfirm={onConfirm} onCancel={noop} />);
    const dialog = screen.getByRole('alertdialog', { name: '¿Eliminar Acme?' });
    expect(dialog).toHaveClass('msg--error');
    expect(within(dialog).getByRole('region', { name: 'Detalles' })).toHaveTextContent('Sus validadores');
    expect(within(dialog).getByText('No se puede deshacer.').closest('.confirm-note')).not.toBeNull();
    const button = within(dialog).getByRole('button', { name: 'Eliminar' });
    expect(button).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Escribe «Acme» para confirmar'), 'Acme');
    await userEvent.click(button);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('todo se puede cambiar: tono, ícono, etiqueta y textos de los botones', () => {
    render(
      <ConfirmDialog
        open
        kind="delete"
        tone="warning"
        icon={<Trash data-testid="propio" />}
        eyebrow="Atención"
        title="¿Quitar a Ana?"
        confirmLabel="Sí, quitar"
        confirmIcon={<Trash data-testid="boton" />}
        cancelLabel="No, volver"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    const dialog = screen.getByRole('alertdialog', { name: '¿Quitar a Ana?' });
    expect(dialog).toHaveClass('msg--warning');
    expect(within(dialog).getByText('Atención')).toBeInTheDocument();
    expect(within(dialog).getByTestId('propio')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sí, quitar' })).toHaveClass('btn--warning');
    expect(within(dialog).getByTestId('boton')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'No, volver' })).toBeInTheDocument();
  });

  it('cerrada (`open={false}`) no dibuja nada', () => {
    render(<ConfirmDialog open={false} title="¿Oculta?" onConfirm={noop} onCancel={noop} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ocupada (`loading`): no se puede cerrar ni volver a confirmar', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="¿Enviar?" loading onConfirm={noop} onCancel={onCancel} />);
    const dialog = screen.getByRole('dialog', { name: '¿Enviar?' });
    expect(within(dialog).queryByRole('button', { name: 'Cerrar' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });
});
