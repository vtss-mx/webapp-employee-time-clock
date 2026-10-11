import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Save } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { currentLocale, setLocale } from '../i18n/core';
import { renderWithProviders } from '../test/render';
import { ConfirmDialog, Modal } from './Modal';
import { DialogHero } from './ui/DialogHero';
import { ReasonFormPanel } from './ReasonFormPanel';

/**
 * Popups, confirmaciones y formularios con motivo en inglés (en-US) y el cambio de idioma en
 * caliente con el popup abierto: sus textos por omisión siguen al idioma activo.
 */

const english = () => setLocale('en-US');
const noop = () => undefined;

describe('ConfirmDialog en inglés: lo que pone cada tipo por omisión', () => {
  it.each([
    ['create', 'New record', 'Create', 'dialog'],
    ['edit', 'Confirm changes', 'Save changes', 'dialog'],
    ['delete', 'Delete', 'Delete', 'alertdialog'],
    ['action', 'Confirmation', 'Confirm', 'dialog'],
  ] as const)('%s → etiqueta "%s" y botón "%s"', async (kind, eyebrow, confirmLabel, role) => {
    await english();
    render(<ConfirmDialog open kind={kind} title="Sure?" onConfirm={noop} onCancel={noop} />);
    const dialog = screen.getByRole(role, { name: 'Sure?' });
    expect(dialog.querySelector('.msg__eyebrow')).toHaveTextContent(eyebrow);
    expect(within(dialog).getByRole('button', { name: confirmLabel })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('cambios ("1 change" / "2 changes", antes → después), detalles y el texto que se escribe para confirmar', async () => {
    await english();
    const { rerender } = render(
      <ConfirmDialog open kind="edit" title="Save Ana?" changes={[{ label: 'Name', before: 'Ana', after: 'Ana María' }]} details={['Shift: Morning']} onConfirm={noop} onCancel={noop} />,
    );
    expect(screen.getByRole('region', { name: 'Changes' })).toHaveTextContent('1 change');
    expect(screen.getByText('Before:')).toHaveClass('sr-only');
    expect(screen.getByText('After:')).toHaveClass('sr-only');
    expect(screen.getByRole('region', { name: 'Details' })).toHaveTextContent('Shift: Morning');
    rerender(
      <ConfirmDialog
        open
        kind="edit"
        title="Save Ana?"
        changes={[
          { label: 'Name', before: 'Ana', after: 'Ana María' },
          { label: 'Email', before: 'a@x.mx', after: 'b@x.mx' },
        ]}
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    expect(screen.getByRole('region', { name: 'Changes' })).toHaveTextContent('2 changes');
    rerender(<ConfirmDialog open kind="delete" title="Delete Ana?" confirmText="Ana" onConfirm={noop} onCancel={noop} />);
    expect(screen.getByLabelText('Type “Ana” to confirm')).toBeInTheDocument();
  });

  it('cambio de idioma en caliente con la confirmación abierta: textos nuevos, lo escrito se conserva', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open kind="delete" title="¿Eliminar a Ana?" confirmText="Ana" onConfirm={onConfirm} onCancel={noop} />);
    await userEvent.type(screen.getByLabelText('Escribe «Ana» para confirmar'), 'Ana');
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled();
    await act(() => english());
    expect(screen.getByLabelText('Type “Ana” to confirm')).toHaveValue('Ana');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('encabezado de los popups en inglés', () => {
  it.each([
    ['error', 'Error'],
    ['warning', 'Attention'],
    ['info', 'Information'],
    ['success', 'Done'],
  ] as const)('%s → "%s"', async (variant, eyebrow) => {
    await english();
    render(
      <Modal open title="QR code" variant={variant} onClose={noop}>
        body
      </Modal>,
    );
    expect(document.querySelector('.msg__eyebrow')).toHaveTextContent(eyebrow);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('encabezado con la posición en la cola', () => {
  it('muestra "1 of 3" y la etiqueta propia en lugar de la del tipo', async () => {
    await english();
    render(<DialogHero variant="info" title="Saved" titleId="t" eyebrow="Profile" queue="1 of 3" />);
    expect(screen.getByText('1 of 3')).toHaveClass('msg__queue');
    expect(screen.getByText('Profile')).toHaveClass('msg__eyebrow');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

describe('formulario con motivo en inglés y con cambio de idioma', () => {
  it('ReasonFormPanel acepta una confirmación que se arma al dibujarse y un título de error fijo', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <ReasonFormPanel
        title="Pedir nueva verificación"
        subtitle="Ana Ruiz"
        backTo="/empleados"
        backLabel="Empleados"
        intro="Se le pedirá verificar su identidad."
        icon={<Save size={20} />}
        field={{ label: 'Motivo para Ana', placeholder: 'Escribe el motivo' }}
        submit={{ label: 'Pedir', icon: <Save size={18} />, variant: 'primary' }}
        confirm={(reason) => () => ({ title: `¿Pedir verificación? (${currentLocale()})`, details: [reason] })}
        onSend={onSend}
        errorTitle="No se pudo pedir"
        onCancel={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText('Motivo para Ana'), 'Cambio de aspecto');
    await userEvent.click(screen.getByRole('button', { name: 'Pedir' }));
    expect(await screen.findByRole('dialog', { name: '¿Pedir verificación? (es-MX)' })).toBeInTheDocument();
    await act(() => english());
    expect(screen.getByRole('dialog', { name: '¿Pedir verificación? (en-US)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onSend).toHaveBeenCalledWith('Cambio de aspecto');
  });
});
