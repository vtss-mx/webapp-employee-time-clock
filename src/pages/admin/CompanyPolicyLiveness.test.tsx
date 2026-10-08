import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { resetPolicyCache } from '../../hooks/useVerificationPolicy';
import { samplePolicy } from '../../test/fixtures';
import { apiFail, apiOk } from '../../test/http';
import { accepting, answer, puts, renderPolicy, serve } from '../../test/companyPolicyKit';

afterEach(() => resetPolicyCache());

/**
 * ADMIN · política de verificación: los cuatro movimientos de la prueba de vida (`enable_turn_right/left`,
 * `enable_look_up/down`) y el destello dictado por el servidor (`flash_paced`), ahora interruptores reales.
 */
describe('Movimientos de la prueba de vida y destello dictado por el servidor', () => {
  it('cuatro interruptores de movimiento: encender uno apagado y apagar uno (relaja) se confirman', async () => {
    const { calls } = accepting(); // samplePolicy: girar der./izq. encendidos; mirar arriba/abajo apagados
    renderPolicy();
    const up = await screen.findByRole('switch', { name: 'Mirar hacia arriba' });
    expect(up).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Mirar hacia abajo' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('switch', { name: 'Girar a la derecha' })).toHaveAttribute('aria-checked', 'true');
    const left = screen.getByRole('switch', { name: 'Girar a la izquierda' });
    expect(left).toHaveAttribute('aria-checked', 'true');

    // Encender un movimiento apagado protege más: confirmación en verde y dice qué podrá pedir la prueba de vida.
    await userEvent.click(up);
    const on = await answer('dialog', '¿Activar «Mirar hacia arriba»?', 'Activar');
    expect(on).toHaveTextContent('La prueba de vida puede pedir mirar hacia arriba.');
    await waitFor(() => expect(up).toHaveAttribute('aria-checked', 'true'));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    // Apagar un movimiento encendido relaja la seguridad: confirmación en rojo con la advertencia de suplantación.
    await userEvent.click(left);
    const off = await answer('alertdialog', '¿Desactivar «Girar a la izquierda»?', 'Desactivar');
    expect(off).toHaveTextContent('Esto reduce la protección contra suplantación de identidad');
    await waitFor(() => expect(left).toHaveAttribute('aria-checked', 'false'));
    expect(puts(calls)).toEqual([{ enable_look_up: true }, { enable_turn_left: false }]);
  });

  it('destello dictado por el servidor: interruptor normal (apagado por omisión) que se enciende con confirmación', async () => {
    const { calls } = accepting(); // sampleAdminPolicy.flash_paced = false (apagado en empresas nuevas)
    renderPolicy();
    // Antes se mostraba retirado y sin control; ahora es un interruptor real (role="switch").
    const paced = await screen.findByRole('switch', { name: 'Destello dictado por el servidor' });
    expect(paced).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(paced);
    const dialog = await answer('dialog', '¿Activar «Destello dictado por el servidor»?', 'Activar');
    expect(dialog).toHaveTextContent('Cada color se revela en el momento: nadie puede preparar las capturas.');
    await waitFor(() => expect(paced).toHaveAttribute('aria-checked', 'true'));
    expect(puts(calls)).toEqual([{ flash_paced: true }]);
  });

  it('dejar menos de dos movimientos: el servidor responde 422 y el popup lo explica; el interruptor vuelve a su estado', async () => {
    serve((call) =>
      call.init.method === 'PUT'
        ? apiFail(422, 'LIVENESS_MOVES_MIN', 'Deben quedar al menos dos movimientos activos.')
        : apiOk(samplePolicy),
    );
    renderPolicy();
    const left = await screen.findByRole('switch', { name: 'Girar a la izquierda' });
    await userEvent.click(left);
    await answer('alertdialog', '¿Desactivar «Girar a la izquierda»?', 'Desactivar');
    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByText('Deben quedar al menos dos movimientos activos.')).toBeInTheDocument();
    expect(left).toHaveAttribute('aria-checked', 'true'); // revertido: el cambio no se aplicó
  });
});
