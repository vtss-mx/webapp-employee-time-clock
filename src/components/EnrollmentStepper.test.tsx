import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { WithCatalogs } from '../test/render';
import { catalogsWith } from '../test/catalogs';
import { completedSteps, type StepperStep } from '../utils/enrollmentStepRules';
import { EnrollmentStepper } from './EnrollmentStepper';

/*
 * El indicador de los pasos, DINÁMICO (decisión del dueño del producto, 2026-10-08): dibuja los pasos que manda el
 * servidor, en su orden, con el nombre de cada uno del catálogo `enrollment_steps` y «Listo» al final. Lo verde solo
 * sale de `done` del servidor.
 */
const show = (steps: readonly StepperStep[], current: string | null) =>
  render(
    <WithCatalogs>
      <EnrollmentStepper steps={steps} current={current} />
    </WithCatalogs>,
  );

const FLOW: StepperStep[] = [
  { code: 'INITIAL_PHOTO', done: true },
  { code: 'FACE_CAPTURES', done: false },
  { code: 'VOICE_VIDEO', done: false },
];

describe('EnrollmentStepper: los pasos del registro', () => {
  it('nombra cada paso con el catálogo, marca el actual y los hechos, y agrega «Listo»', () => {
    show(FLOW, 'FACE_CAPTURES');
    const list = screen.getByRole('list', { name: 'Paso 2 de 4' });
    const items = list.querySelectorAll('li');
    expect(items).toHaveLength(4);
    expect(items[0].className).toBe('is-done');
    expect(items[0].querySelector('.enroll-steps__dot svg')).not.toBeNull(); // hecho: la palomita en lugar del número
    expect(items[1].className).toBe('is-current');
    expect(items[1].getAttribute('aria-current')).toBe('step');
    expect(items[1].querySelector('.enroll-steps__dot')).toHaveTextContent('2');
    expect(items[2].className).toBe('');
    expect(items[2].querySelector('.enroll-steps__dot')).toHaveTextContent('3');
    expect(screen.getByText('Foto inicial')).toBeInTheDocument();
    expect(screen.getByText('Identificación biométrica')).toBeInTheDocument();
    expect(screen.getByText('Video con preguntas')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
  });

  it('un flujo a la medida se dibuja en SU orden, con cualquier subconjunto de pasos', () => {
    show([{ code: 'OFFICIAL_ID', done: true }, { code: 'FACE_CAPTURES', done: false }], 'FACE_CAPTURES');
    const items = screen.getByRole('list', { name: 'Paso 2 de 3' }).querySelectorAll('li');
    expect([...items].map((item) => item.textContent)).toEqual(['Identificación oficial', '2Identificación biométrica', '3Listo']);
  });

  it('un paso hecho va en verde aunque esté DESPUÉS del actual (lo dice el servidor, no la posición)', () => {
    show([{ code: 'INITIAL_PHOTO', done: false }, { code: 'OFFICIAL_ID', done: true }], 'INITIAL_PHOTO');
    const items = screen.getByRole('list', { name: 'Paso 1 de 3' }).querySelectorAll('li');
    expect([...items].map((item) => item.className)).toEqual(['is-current', 'is-done', '']);
  });

  it('sin paso actual («En validación») todos van hechos y «Listo» queda en curso', () => {
    show(completedSteps(['INITIAL_PHOTO', 'FACE_CAPTURES']), null);
    const items = screen.getByRole('list', { name: 'Paso 3 de 3' }).querySelectorAll('li');
    expect([...items].map((item) => item.className)).toEqual(['is-done', 'is-done', 'is-current']);
  });

  it('un código que el catálogo no trae se dibuja con su código (nunca se rompe)', () => {
    render(
      <WithCatalogs catalogs={catalogsWith({ enrollment_steps: [] })}>
        <EnrollmentStepper steps={[{ code: 'FUTURE_STEP', done: false }]} current="FUTURE_STEP" />
      </WithCatalogs>,
    );
    expect(screen.getByText('FUTURE_STEP')).toBeInTheDocument();
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    show(FLOW, 'VOICE_VIDEO');
    expect(screen.getByRole('list', { name: 'Step 3 of 4' })).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });
});
