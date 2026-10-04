import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ChoiceGroup } from './ChoiceGroup';
import { RadioCard } from './RadioCard';

type Plan = 'basic' | 'pro' | 'max';
const PLANS: Array<{ value: Plan; title: string; description?: string }> = [
  { value: 'basic', title: 'Básico', description: 'Solo QR' },
  { value: 'pro', title: 'Pro' },
  { value: 'max', title: 'Máximo', description: 'QR y rostro' },
];

function Harness({ disabled = false, error, hint }: { disabled?: boolean; error?: string; hint?: string }) {
  const [plan, setPlan] = useState<Plan>('basic');
  return (
    <>
      <ChoiceGroup label="Plan" className="plans" radio disabled={disabled} error={error} hint={hint}>
        {PLANS.map((item) => (
          <RadioCard key={item.value} name="plan" value={item.value} checked={plan === item.value} onChange={setPlan} title={item.title} description={item.description} icon={<span>★</span>} />
        ))}
      </ChoiceGroup>
      <output>{plan}</output>
    </>
  );
}

describe('RadioCard en un ChoiceGroup', () => {
  it('grupo de opciones con nombre; el radio nativo queda oculto y la tarjeta dibuja su indicador', async () => {
    render(<Harness hint="Elige uno" />);
    const group = screen.getByRole('radiogroup', { name: 'Plan' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group).toHaveClass('field', 'choice-group', 'plans');
    expect(group).toHaveAccessibleDescription('Elige uno');
    const basic = within(group).getByRole('radio', { name: 'Básico' });
    expect(basic).toBeChecked();
    expect(basic).toHaveClass('radio-card__input');
    expect(basic).toHaveAccessibleDescription('Solo QR');
    expect(within(group).getByRole('radio', { name: 'Pro' })).not.toHaveAttribute('aria-describedby');
    const card = basic.closest('label') as HTMLElement;
    expect(card).toHaveClass('radio-card', 'radio-card--md', 'radio-card--indicator-end', 'is-checked');
    expect(card.querySelector('.radio-card__indicator')).toHaveAttribute('aria-hidden');
    expect(card.querySelector('.radio-card__icon')).toHaveTextContent('★');

    await userEvent.click(screen.getByText('QR y rostro')); // toda la tarjeta se toca
    expect(document.querySelector('output')).toHaveTextContent('max');
    expect(within(group).getByRole('radio', { name: 'Máximo' })).toBeChecked();
  });

  it('las flechas recorren y eligen las opciones del grupo (mismo name)', async () => {
    render(<Harness />);
    screen.getByRole('radio', { name: 'Básico' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Pro' })).toHaveFocus();
    expect(document.querySelector('output')).toHaveTextContent('pro');
    await userEvent.keyboard('{ArrowUp}');
    expect(document.querySelector('output')).toHaveTextContent('basic');
  });

  it('grupo deshabilitado (fieldset): ninguna opción cambia; el error reemplaza la ayuda', async () => {
    render(<Harness disabled error="Elige un plan" hint="Elige uno" />);
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeDisabled();
    await userEvent.click(screen.getByText('Pro'));
    expect(document.querySelector('output')).toHaveTextContent('basic');
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un plan');
    expect(screen.getByRole('radiogroup')).toHaveClass('field--error');
  });

  it('variantes: compacta, indicador al inicio, sin ícono, deshabilitada por sí sola y grupo normal', () => {
    render(
      <ChoiceGroup label="Días">
        <RadioCard name="x" value="a" checked={false} onChange={() => undefined} title="A" size="sm" indicator="start" disabled className="mine" />
      </ChoiceGroup>,
    );
    expect(screen.getByRole('group', { name: 'Días' })).not.toHaveAttribute('role');
    const radio = screen.getByRole('radio', { name: 'A' });
    expect(radio).toBeDisabled();
    const card = radio.closest('label') as HTMLElement;
    expect(card).toHaveClass('radio-card--sm', 'radio-card--indicator-start', 'mine');
    expect(card).not.toHaveClass('is-checked');
    expect(card.querySelector('.radio-card__icon')).toBeNull();
  });
});
