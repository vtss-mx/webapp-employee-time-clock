import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Save } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { currentLocale, setLocale } from '../i18n/core';
import { renderWithProviders } from '../test/render';
import type { BulkResult } from '../types';
import { bulkResultMessage, BulkResultSummary } from './BulkResultSummary';
import { ConfirmDialog, Modal } from './Modal';
import { DialogHero } from './ui/DialogHero';
import { ReasonFormPanel } from './ReasonFormPanel';
import { RejectRequestPanel, validateRejectNote } from './RejectRequestPanel';

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

describe('resultado de una operación masiva en inglés', () => {
  const outcome = (id: number, result: 'DONE' | 'SKIPPED', message: string | null = null) => ({ employee: { id, full_name: `Person ${id}`, employee_number: `EMP-${id}` }, result, code: null, message });
  const copy = { title: 'Shift assigned', done: 'Assigned', unchanged: 'Already had it', skipped: 'Not assigned' };

  it('con omisiones: título, número de empleado y "and N more"', async () => {
    await english();
    const result: BulkResult = { done: 9, unchanged: 0, skipped: 1, results: [...Array.from({ length: 9 }, (_, i) => outcome(i + 1, 'DONE')), outcome(20, 'SKIPPED', 'Inactive')] };
    expect(bulkResultMessage(result, copy)).toMatchObject({ variant: 'warning', title: 'Shift assigned (some skipped)' });
    render(<BulkResultSummary result={result} copy={copy} />);
    expect(screen.getByText('No. EMP-20')).toBeInTheDocument();
    expect(screen.getByText('and 1 more')).toBeInTheDocument();
  });
});

const question = () =>
  currentLocale() === 'en-US'
    ? { title: 'Reject the request?', eyebrow: 'Shift change', message: 'Ana keeps her shift.', facts: [{ label: 'Shift', value: 'Morning' }] }
    : { title: '¿Rechazar la solicitud?', eyebrow: 'Cambio de turno', message: 'Ana conserva su turno.', facts: [{ label: 'Turno', value: 'Matutino' }] };

describe('rechazar una solicitud en inglés y con cambio de idioma', () => {
  it('nota obligatoria, confirmación y error en el idioma activo (también con el popup abierto)', async () => {
    await english();
    const onSend = vi.fn().mockRejectedValue(new Error('down'));
    renderWithProviders(<RejectRequestPanel title="Reject request" subtitle="Ana Ruiz · EMP-7" backTo="/requests" intro="Ana asked to change shifts." placeholder="Why?" question={question} onSend={onSend} onCancel={noop} />);
    expect(screen.getByRole('link', { name: 'Requests' })).toHaveAttribute('href', '/requests');
    expect(screen.getByRole('heading', { name: 'Reason' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Explain why (at least 5 characters). The employee will see it.');

    await userEvent.type(screen.getByLabelText('Note for the employee'), '  Not enough staff ');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Reject the request?' });
    expect(dialog).toHaveTextContent('Note they will see');
    expect(dialog).toHaveTextContent('Not enough staff');

    await act(() => setLocale('es-MX'));
    const spanish = screen.getByRole('alertdialog', { name: '¿Rechazar la solicitud?' });
    expect(spanish).toHaveTextContent('Nota que verá');
    expect(spanish).toHaveTextContent('Matutino');
    await userEvent.click(within(spanish).getByRole('button', { name: 'Rechazar' }));
    expect(onSend).toHaveBeenCalledWith('Not enough staff');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo rechazar la solicitud' })).toBeInTheDocument();
    await act(() => english());
    expect(screen.getByRole('alertdialog', { name: "Couldn't reject the request" })).toBeInTheDocument();
  });

  it('la regla de la nota en español', () => {
    expect(validateRejectNote(' no ')).toBe('Explica el motivo (al menos 5 caracteres). El empleado lo verá.');
    expect(validateRejectNote('Falta personal')).toBeUndefined();
  });

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
