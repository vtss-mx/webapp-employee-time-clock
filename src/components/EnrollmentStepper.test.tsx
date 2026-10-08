import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setLocale } from '../i18n';
import { ENROLLMENT_STEPS, EnrollmentStepper } from './EnrollmentStepper';

describe('EnrollmentStepper: los pasos del registro', () => {
  it('marca el paso actual y los hechos, y nombra cada paso en el idioma activo', () => {
    render(<EnrollmentStepper current="captures" withVideo />);
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
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('Listo')).toBeInTheDocument();
  });

  it('sin la verificación por voz de la política, el paso del video no se muestra; en «Listo» todos los anteriores van hechos', () => {
    render(<EnrollmentStepper current="done" withVideo={false} />);
    const list = screen.getByRole('list', { name: 'Paso 3 de 3' });
    expect(screen.queryByText('Video')).not.toBeInTheDocument();
    const items = list.querySelectorAll('li');
    expect([...items].map((item) => item.className)).toEqual(['is-done', 'is-done', 'is-current']);
  });

  it('en inglés', async () => {
    await setLocale('en-US');
    render(<EnrollmentStepper current="video" withVideo />);
    expect(screen.getByRole('list', { name: 'Step 3 of 4' })).toBeInTheDocument();
    expect(screen.getByText('First photo')).toBeInTheDocument();
  });

  it('los pasos van en su orden fijo', () => {
    expect(ENROLLMENT_STEPS).toEqual(['photo', 'captures', 'video', 'done']);
  });
});
