import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TabPanel, Tabs } from './Tabs';

type Key = 'one' | 'two' | 'three' | 'four';

function Harness() {
  const [tab, setTab] = useState<Key>('one');
  const items = [
    { key: 'one' as const, label: 'Uno' },
    { key: 'two' as const, label: 'Dos', count: 3, countLabel: 'pendientes' },
    { key: 'four' as const, label: 'Cuatro', count: 1 },
    { key: 'three' as const, label: 'Tres', count: 0 },
  ];
  return (
    <>
      <Tabs items={items} value={tab} onChange={setTab} label="Secciones" idBase="t" />
      <TabPanel idBase="t" tab={tab}>
        Contenido {tab}
      </TabPanel>
    </>
  );
}

describe('Tabs', () => {
  it('une cada pestaña con su panel, muestra el contador y cambia con clic o teclado', async () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Secciones' });
    expect(list).toHaveClass('tabs');
    const one = screen.getByRole('tab', { name: 'Uno' });
    expect(one).toHaveAttribute('aria-selected', 'true');
    expect(one).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Dos, 3 pendientes' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tab', { name: 'Tres' })).toBeInTheDocument(); // 0: sin contador
    expect(screen.getByRole('tab', { name: 'Cuatro, 1' })).toBeInTheDocument();
    expect(screen.getByRole('tabpanel', { name: 'Uno' })).toHaveTextContent('Contenido one');
    expect(one).toHaveAttribute('aria-controls', 't-panel-one');

    await userEvent.click(screen.getByRole('tab', { name: 'Dos, 3 pendientes' }));
    expect(screen.getByRole('tabpanel', { name: 'Dos, 3 pendientes' })).toHaveTextContent('Contenido two');

    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Cuatro, 1' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}'); // da la vuelta
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Uno' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveFocus();
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.getByRole('tab', { name: 'Tres' })).toHaveAttribute('aria-selected', 'true');
  });
});
