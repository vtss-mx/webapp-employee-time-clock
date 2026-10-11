import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { accepting, answer, puts, renderPolicy, serve } from '../../test/companyPolicyKit';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk } from '../../test/http';

/*
 * Reordenar con «Subir» (el caso de «Bajar» y el resto del flujo están en `CompanyPolicyEnrollment.test.tsx`): la
 * confirmación dice el orden completo «antes → después», cancelar no envía nada y un rechazo del servidor lo explica el
 * popup del guardado. El flujo de la política de prueba es: Foto inicial, Identificación biométrica y Video con preguntas.
 */
const before = 'Foto inicial, Identificación biométrica y Video con preguntas';
const flowList = () => screen.getByRole('list', { name: 'Pasos del registro, en orden' });

afterEach(() => resetPolicyCache());

describe('Pasos del registro: «Subir»', () => {
  it('sube un paso un lugar: confirma el orden antes → después, guarda la lista nueva y avisa', async () => {
    const { calls } = accepting();
    renderPolicy();
    await userEvent.click(await screen.findByRole('button', { name: 'Subir «Video con preguntas»' }));
    const dialog = await answer('dialog', '¿Mover «Video con preguntas» al paso 2?', 'Guardar orden');
    expect(dialog).toHaveTextContent(before);
    expect(dialog).toHaveTextContent('Foto inicial, Video con preguntas e Identificación biométrica');
    await waitFor(() => expect(puts(calls)).toEqual([{ enrollment_steps: ['INITIAL_PHOTO', 'VOICE_VIDEO', 'FACE_CAPTURES'] }]));
    const notice = await screen.findByRole('dialog', { name: 'Video con preguntas: cambió de lugar' });
    expect(notice).toHaveTextContent('Foto inicial, Video con preguntas e Identificación biométrica');
  });

  it('cancelar la confirmación no envía nada y el flujo queda como estaba', async () => {
    const { calls } = accepting();
    renderPolicy();
    await userEvent.click(await screen.findByRole('button', { name: 'Subir «Identificación biométrica»' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Mover «Identificación biométrica» al paso 1?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(puts(calls)).toEqual([]);
    expect(within(flowList()).getAllByRole('listitem')[0]).toHaveTextContent('Foto inicial');
  });

  it('el servidor rechaza el orden (422): se marca en el campo y la lista vuelve como estaba', async () => {
    serve((call) => (call.init.method === 'PUT' ? apiFail(422, 'INVALID_ENROLLMENT_STEPS', 'Ese orden no es válido') : apiOk(samplePolicy)));
    renderPolicy();
    await userEvent.click(await screen.findByRole('button', { name: 'Subir «Video con preguntas»' }));
    await answer('dialog', '¿Mover «Video con preguntas» al paso 2?', 'Guardar orden');
    expect((await screen.findAllByText('Ese orden no es válido')).length).toBeGreaterThan(0);
    expect(within(flowList()).getAllByRole('listitem')[2]).toHaveTextContent('Video con preguntas');
  });
});
