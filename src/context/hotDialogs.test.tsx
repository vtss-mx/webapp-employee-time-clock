import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useConfirm } from '../hooks/useConfirm';
import { useFeedback } from '../hooks/useFeedback';
import { setLocale, t } from '../i18n/core';
import { clientError } from '../services/http/envelope';
import { renderWithProviders } from '../test/render';

/**
 * Popups y confirmaciones ABIERTOS siguen al idioma (regla 16, cambio en caliente): se arman al
 * dibujarse, así que al cambiar el idioma se traducen sin cerrarse ni perder su lugar en la cola.
 */
type Api = { feedback: ReturnType<typeof useFeedback>; confirm: ReturnType<typeof useConfirm> };

function Probe({ onReady }: { onReady: (api: Api) => void }) {
  onReady({ feedback: useFeedback(), confirm: useConfirm() });
  return null;
}

function setup() {
  let api: Api | undefined;
  renderWithProviders(<Probe onReady={(value) => (api = value)} />);
  return () => api as Api;
}

describe('popups abiertos al cambiar el idioma', () => {
  it('un mensaje armado con una función se traduce completo (título, texto y botón por omisión)', async () => {
    const api = setup();
    void act(() => void api().feedback.show(() => ({ variant: 'info', title: t('feedback.noChanges.title'), text: t('feedback.noChanges.text') })));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Sin cambios');
    expect(within(dialog).getByRole('button', { name: 'Entendido' })).toBeInTheDocument();

    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog')).toBe(dialog); // el mismo popup, abierto
    expect(dialog).toHaveTextContent('No changes');
    expect(dialog).toHaveTextContent("There's nothing to save");
    expect(within(dialog).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('un error con "Reintentar": su título, el texto que armó la app y los botones cambian; un título fijo se respeta', async () => {
    const api = setup();
    const retry = vi.fn();
    void act(() => void api().feedback.fromError(clientError(0, 'trace-9'), { title: () => t('language.loadFailed'), retry }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('No se pudo cambiar el idioma');
    expect(dialog).toHaveTextContent('Código de rastreo');

    await act(() => setLocale('en-US'));
    expect(dialog).toHaveTextContent("Couldn't change the language");
    expect(dialog).toHaveTextContent("Couldn't reach the server. Check your connection.");
    expect(dialog).toHaveTextContent('Trace code');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();

    void act(() => void api().feedback.warning('Título fijo', () => t('feedback.invalidForm.text')));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Título fijo');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Fix the highlighted fields.');
  });

  it('el resumen de un formulario inválido se recalcula con los errores en el idioma nuevo', async () => {
    const api = setup();
    void act(() => void api().feedback.invalidForm(() => ({ email: t('common.fields.email'), name: undefined })));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Revisa los datos');
    expect(dialog).toHaveTextContent('Correo electrónico');
    await act(() => setLocale('en-US'));
    expect(dialog).toHaveTextContent('Check the details');
    expect(dialog).toHaveTextContent('Email');
  });

  it('una confirmación abierta se traduce y sigue esperando la respuesta', async () => {
    const api = setup();
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = api().confirm(() => ({ kind: 'edit', title: t('language.label'), details: [{ label: t('common.fields.name'), value: 'Ana' }] }));
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Idioma');
    expect(dialog).toHaveTextContent('Nombre');
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(dialog).toHaveTextContent('Language');
    expect(dialog).toHaveTextContent('Name');
    await userEvent.click(within(dialog).getAllByRole('button').at(-1) as HTMLElement);
    await expect(answer).resolves.toBe(true);
  });

  it('una edición sin cambios no pregunta: avisa "Sin cambios" (también en inglés)', async () => {
    const api = setup();
    await setLocale('en-US');
    let answer: Promise<boolean> | undefined;
    act(() => {
      answer = api().confirm({ kind: 'edit', title: 'x', changes: [] });
    });
    await expect(answer).resolves.toBe(false);
    expect(await screen.findByRole('dialog')).toHaveTextContent('No changes');
  });
});
