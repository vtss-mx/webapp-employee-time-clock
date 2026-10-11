import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { accepting, answer, puts, renderPolicy, serve } from '../../test/companyPolicyKit';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk } from '../../test/http';

/*
 * Los PASOS del registro de identidad en la política del ADMIN (decisión del dueño del producto, 2026-10-08: el flujo
 * es dinámico; el ADMIN decide, por empresa, cuáles pasos se piden y en qué orden). La sección edita
 * `enrollment_steps`: estar en la lista = el paso se pide; el orden del arreglo = el orden del flujo. Las capturas no
 * se pueden quitar, quitar un paso relaja (regla de dos personas) y el 422 del servidor se marca en el campo.
 */
const FLOW = ['INITIAL_PHOTO', 'FACE_CAPTURES', 'VOICE_VIDEO'];
const flowList = () => screen.getByRole('list', { name: 'Pasos del registro, en orden' });
const rows = () => within(flowList()).getAllByRole('listitem');

afterEach(() => resetPolicyCache());

describe('CompanyPolicyPage: los pasos del registro de identidad', () => {
  it('dibuja los cinco pasos del catálogo: los que se piden en su orden y después los que no', async () => {
    accepting();
    renderPolicy();
    await screen.findByRole('heading', { name: 'Pasos del registro de identidad' });
    const list = rows();
    expect(list.map((row) => row.querySelector('.switch-row__label')?.textContent?.trim())).toEqual([
      'Foto inicial',
      'Identificación biométrica Obligatorio',
      'Video con preguntas',
      'Identificación oficial',
      'Comprobante de domicilio',
    ]);
    expect(list[0]).toHaveTextContent('Paso 1 de 3');
    expect(list[3]).toHaveTextContent('No se pide');
    // La descripción de cada paso sale del catálogo (el backend la manda traducida).
    expect(list[0]).toHaveTextContent('Una foto de frente que queda como la foto de referencia del registro.');
    expect(screen.getByText('El paso «Identificación biométrica» siempre se pide y queda al final del flujo.')).toBeInTheDocument();
  });

  it('las capturas no se pueden quitar: su interruptor queda fijo con el motivo como ayuda', async () => {
    accepting();
    renderPolicy();
    const locked = await screen.findByRole('switch', { name: 'Identificación biométrica' });
    expect(locked).toBeDisabled();
    expect(locked).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Siempre se pide: es el registro que valida la empresa.')).toBeInTheDocument();
  });

  it('pedir un paso nuevo: confirma, lo agrega al final del flujo y avisa', async () => {
    const { calls } = accepting();
    renderPolicy();
    await userEvent.click(await screen.findByRole('switch', { name: 'Identificación oficial' }));
    const dialog = await answer('dialog', '¿Pedir «Identificación oficial»?', 'Activar');
    expect(dialog).toHaveTextContent('Cada empleado tendrá que completar «Identificación oficial» en su registro.');
    await waitFor(() => expect(puts(calls)).toEqual([{ enrollment_steps: [...FLOW, 'OFFICIAL_ID'] }]));
    expect(await screen.findByRole('dialog', { name: 'Identificación oficial: ahora se pide' })).toBeInTheDocument();
  });

  it('dejar de pedir un paso RELAJA: la confirmación lo advierte en rojo y lo saca de la lista', async () => {
    const { calls } = accepting();
    renderPolicy();
    await userEvent.click(await screen.findByRole('switch', { name: 'Video con preguntas' }));
    const dialog = await answer('alertdialog', '¿Dejar de pedir «Video con preguntas»?', 'Desactivar');
    expect(dialog).toHaveTextContent('Pedir menos pasos reduce las pruebas de que la persona es quien dice ser.');
    await waitFor(() => expect(puts(calls)).toEqual([{ enrollment_steps: ['INITIAL_PHOTO', 'FACE_CAPTURES'] }]));
    expect(await screen.findByRole('dialog', { name: 'Video con preguntas: ya no se pide' })).toBeInTheDocument();
  });

  it('reordenar: «Bajar» y «Subir» confirman con el orden antes → después y guardan la lista nueva', async () => {
    const { calls } = accepting();
    renderPolicy();
    const down = await screen.findByRole('button', { name: 'Bajar «Foto inicial»' });
    await userEvent.click(down);
    const dialog = await answer('dialog', '¿Mover «Foto inicial» al paso 2?', 'Guardar orden');
    expect(dialog).toHaveTextContent('Foto inicial, Identificación biométrica y Video con preguntas');
    expect(dialog).toHaveTextContent('Identificación biométrica, Foto inicial y Video con preguntas');
    await waitFor(() => expect(puts(calls)).toEqual([{ enrollment_steps: ['FACE_CAPTURES', 'INITIAL_PHOTO', 'VOICE_VIDEO'] }]));
    expect(await screen.findByRole('dialog', { name: 'Foto inicial: cambió de lugar' })).toBeInTheDocument();
  });

  it('el primero no se puede subir, el último no se puede bajar y un paso que no se pide no se mueve', async () => {
    accepting();
    renderPolicy();
    expect(await screen.findByRole('button', { name: 'Subir «Foto inicial»' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar «Video con preguntas»' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir «Identificación oficial»' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar «Identificación oficial»' })).toBeDisabled();
  });

  it('un 422 INVALID_ENROLLMENT_STEPS del servidor se marca en el campo (y la lista vuelve como estaba)', async () => {
    serve((call) => (call.init.method === 'PUT' ? apiFail(422, 'INVALID_ENROLLMENT_STEPS', 'Elige uno de los pasos del registro disponibles') : apiOk(samplePolicy)));
    renderPolicy();
    await userEvent.click(await screen.findByRole('switch', { name: 'Video con preguntas' }));
    await answer('alertdialog', '¿Dejar de pedir «Video con preguntas»?', 'Desactivar');
    expect((await screen.findAllByText('Elige uno de los pasos del registro disponibles')).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Video con preguntas' })).toHaveAttribute('aria-checked', 'true'));
  });

  it('otra falla del servidor NO se marca en el campo: la explica el popup del guardado', async () => {
    serve((call) => (call.init.method === 'PUT' ? apiFail(503, 'SERVER_BUSY', 'Servidor ocupado') : apiOk(samplePolicy)));
    renderPolicy();
    await userEvent.click(await screen.findByRole('switch', { name: 'Video con preguntas' }));
    await answer('alertdialog', '¿Dejar de pedir «Video con preguntas»?', 'Desactivar');
    expect(await screen.findByRole('alertdialog', { name: 'No se pudo guardar' })).toHaveTextContent('Servidor ocupado');
    expect(screen.queryByText('Elige uno de los pasos del registro disponibles')).toBeNull();
  });

  it('un paso del flujo que el catálogo ya no trae también se dibuja (nunca se oculta un cambio)', async () => {
    const flow = { ...samplePolicy, enrollment_steps: ['FACE_CAPTURES', 'FUTURE_STEP'] };
    serve((call) => apiOk(call.init.method === 'PUT' ? flow : flow));
    renderPolicy();
    await screen.findByRole('heading', { name: 'Pasos del registro de identidad' });
    expect(within(flowList()).getByText('FUTURE_STEP')).toBeInTheDocument();
  });
});
