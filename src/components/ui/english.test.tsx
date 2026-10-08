import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { setLocale } from '../../i18n/core';
import { WithCatalogs } from '../../test/render';
import { ConfirmPasswordField, FormField } from '../FormField';
import { FormFooter } from '../FormFooter';
import { PageHeader } from '../PageHeader';
import { PageLoader, Spinner } from '../Spinner';
import { StatusBadge } from '../StatusBadge';
import { ColumnChart } from './ColumnChart';
import { CopyField } from './CopyField';
import { DateField, dateOrder, displayToValue, isoToDisplay } from './DateField';
import { FilePicker } from './FilePicker';
import { ListToolbar } from './ListControls';
import { NumberField } from './NumberField';
import { PagedItems, type ListState } from './PagedItems';
import { Paginator } from './Paginator';
import { PhoneField } from './PhoneField';
import { RangeMeter } from './RangeMeter';
import { Select } from './Select';

/**
 * Componentes base en inglés (en-US) y el cambio de idioma en caliente: sus textos por omisión, el
 * orden de la fecha y los formatos siguen al idioma activo sin perder lo que la persona escribió.
 */

const english = () => setLocale('en-US');

function DateHarness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateField label="Birth date" value={value} onChange={setValue} min="1920-01-01" max="2010-06-15" />
      <output>{value}</output>
    </>
  );
}

const output = () => document.querySelector('output')?.textContent;

describe('DateField en inglés: mm/dd/yyyy y calendario del idioma', () => {
  it('orden de la fecha según el idioma; conversión en ambos órdenes', async () => {
    expect(dateOrder()).toBe('dmy');
    await english();
    expect(dateOrder()).toBe('mdy');
    expect(isoToDisplay('2001-01-09')).toBe('01/09/2001');
    expect(isoToDisplay('2001-01-09', { order: 'dmy', separator: '/' })).toBe('09/01/2001');
    expect(displayToValue('01/09/2001')).toBe('2001-01-09');
    expect(displayToValue('02/31/2001')).toBe('02/31/2001'); // completa pero inexistente → inválida
  });

  it('se escribe mm/dd/yyyy y entrega ISO; el calendario nombra meses y días en inglés', async () => {
    await english();
    render(<DateHarness />);
    const input = screen.getByLabelText('Birth date');
    expect(input).toHaveAttribute('placeholder', 'mm/dd/yyyy');
    await userEvent.type(input, '03151990');
    expect(input).toHaveValue('03/15/1990');
    expect(output()).toBe('1990-03-15');

    await userEvent.click(screen.getByRole('button', { name: 'Open calendar' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose date' });
    expect(within(dialog).getAllByRole('columnheader').map((day) => day.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(screen.getByRole('gridcell', { name: 'March 15, 1990' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Choose month, current: March' }));
    const months = screen.getByRole('group', { name: 'Months of 1990' });
    expect(within(months).getByRole('button', { name: 'June 1990' })).toHaveTextContent('Jun');
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next year' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Choose year, current: 1990' }));
    expect(screen.getByRole('group', { name: 'Years' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous years' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next years' })).toBeEnabled();
  });

  it('cambio de idioma en caliente: la fecha se reescribe en el orden nuevo, el valor ISO no cambia y lo escrito a medias se conserva', async () => {
    render(<DateHarness initial="1990-03-15" />);
    const input = screen.getByLabelText('Birth date');
    expect(input).toHaveValue('15/03/1990');
    expect(screen.getByRole('button', { name: 'Abrir calendario' })).toBeInTheDocument();

    await act(() => english());
    expect(input).toHaveValue('03/15/1990');
    expect(output()).toBe('1990-03-15');
    expect(input).toHaveAttribute('placeholder', 'mm/dd/yyyy');
    expect(screen.getByRole('button', { name: 'Open calendar' })).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '0412');
    await act(() => setLocale('es-MX'));
    expect(input).toHaveValue('04/12'); // a medias: se queda como se escribió
    expect(output()).toBe('');
  });
});

describe('Paginator y estados de un listado en inglés', () => {
  it('rango, tamaños, botones y "Page 2 of 124" con separador de miles', async () => {
    await english();
    render(<Paginator page={2} size={10} total={1234} onPage={() => undefined} onSize={() => undefined} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.querySelector('.pager__range')).toHaveTextContent('Showing 11–20 of 1,234 results');
    expect(within(nav).getByText('Per page')).toBeInTheDocument();
    for (const name of ['First page', 'Previous page', 'Page 2', 'Next page', 'Last page']) expect(within(nav).getByRole('button', { name })).toBeInTheDocument();
    expect(nav.querySelector('.pager__status')).toHaveTextContent('Page 2 of 124');
  });

  it('un solo elemento: "Showing 1 of 1 result"; el sustantivo propio se respeta', async () => {
    await english();
    const { rerender } = render(<Paginator page={1} size={10} total={1} onPage={() => undefined} />);
    expect(document.querySelector('.pager__range')).toHaveTextContent('Showing 1 of 1 result');
    rerender(<Paginator page={1} size={10} total={3} noun={{ one: 'employee', other: 'employees' }} onPage={() => undefined} />);
    expect(document.querySelector('.pager__range')).toHaveTextContent('Showing 1–3 of 3 employees');
  });

  it('cambio de idioma en caliente con la página elegida', async () => {
    render(<Paginator page={3} size={10} total={57} onPage={() => undefined} />);
    expect(document.querySelector('.pager__range')).toHaveTextContent('Mostrando 21–30 de 57 resultados');
    await act(() => english());
    expect(document.querySelector('.pager__range')).toHaveTextContent('Showing 21–30 of 57 results');
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
  });

  it('PagedItems: esqueleto "Loading", "Reload" si falló, EmptyState y los elementos con su paginador', async () => {
    await english();
    const retry = vi.fn();
    const base: ListState<{ id: number }> = { data: null, error: null, loading: true, retry, page: 1, size: 10, total: 0, setPage: () => undefined, setSize: () => undefined };
    const empty = { icon: <span />, title: 'No employees yet', description: 'Employees you add will appear here.' };
    const view = (list: ListState<{ id: number }>) => (
      <PagedItems list={list} empty={empty}>
        {(items) => <p>{items.length} items</p>}
      </PagedItems>
    );
    const { rerender } = render(view(base));
    expect(screen.getByLabelText('Loading')).toHaveAttribute('aria-busy', 'true');
    rerender(view({ ...base, loading: false, error: new Error('down') }));
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(retry).toHaveBeenCalledOnce();
    rerender(view({ ...base, loading: false, data: { items: [] } }));
    expect(screen.getByRole('status')).toHaveTextContent('No employees yetEmployees you add will appear here.');
    rerender(view({ ...base, loading: false, data: { items: [{ id: 1 }] }, total: 1 }));
    expect(screen.getByText('1 items')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toHaveTextContent('Showing 1 of 1 result');
  });
});

describe('campos y piezas base en inglés', () => {
  it('campos: contraseña, verificación en vivo, confirmar contraseña, número, archivo', async () => {
    await english();
    render(
      <>
        <FormField label="Password" type="password" />
        <FormField label="Email" status={{ tone: 'checking', text: '' }} />
        <ConfirmPasswordField />
        <ConfirmPasswordField label="Repeat it" />
        <NumberField label="Radius" value="5" onChange={() => undefined} unit="m" />
        <FilePicker label="Receipt" value={null} onChange={() => undefined} />
      </>,
    );
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(3);
    expect(screen.getByLabelText('Checking')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText('Repeat it')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase' })).toBeInTheDocument();
    expect(screen.getByText('Choose file')).toBeInTheDocument();
    expect(screen.getByText('or drag it here')).toBeInTheDocument();
  });

  it('archivo elegido: "Change" y "Remove file"', async () => {
    await english();
    render(<FilePicker label="Receipt" value={new File(['x'], 'receipt.pdf')} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove file' })).toBeInTheDocument();
  });

  it('listas: buscador, filtro por estado y lista propia con búsqueda', async () => {
    await english();
    render(
      <>
        <ListToolbar search="" onSearch={() => undefined} placeholder="Search employees" label="Search" filter="all" onFilter={() => undefined} />
        <Select value="" onChange={() => undefined} aria-label="Country" options={[{ value: 'mx', label: 'Mexico' }]} searchable />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Filter by status All statuses' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['All statuses', 'Active', 'Inactive']);
    await userEvent.keyboard('{Escape}');
    const country = screen.getByRole('button', { name: 'Country Select an option' });
    await userEvent.click(country);
    const search = screen.getByRole('combobox', { name: 'Search…' });
    await userEvent.type(search, 'zz');
    expect(screen.getByRole('status')).toHaveTextContent('No results');
  });

  it('teléfono: lada, búsqueda de países y "No results for"', async () => {
    await english();
    render(<PhoneField label="Phone" value="" onChange={() => undefined} />, { wrapper: WithCatalogs });
    const toggle = screen.getByRole('button', { name: /^Country code: .+ \(\+52\)\. Change country$/ });
    await userEvent.click(toggle);
    const search = screen.getByRole('combobox', { name: 'Search country or code' });
    expect(search).toHaveAttribute('placeholder', 'Country or code');
    expect(screen.getByRole('listbox', { name: 'Countries' })).toBeInTheDocument();
    await userEvent.type(search, 'zzz');
    expect(screen.getByText('No results for “zzz”')).toBeInTheDocument();
  });

  it('carga, encabezado, pie de formulario, estado, copiar y medidor', async () => {
    await english();
    const onCancel = vi.fn();
    render(
      <MemoryRouter>
        <Spinner />
        <PageLoader />
        <PageHeader title="Employee" backTo="/employees" />
        <PageHeader title="Site" backTo="/sites" backLabel="Sites" />
        <FormFooter submitLabel="Save" submitIcon={null} saving={false} onCancel={onCancel} />
        <StatusBadge active />
        <StatusBadge active={false} />
        <CopyField value="tc_live_123" />
        <RangeMeter value={1234.5} min={0} max={2000} label="Turn" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/employees');
    expect(screen.getByRole('link', { name: 'Sites' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toHaveTextContent('Copy');
    expect(screen.getByRole('meter', { name: 'Turn' })).toHaveAttribute('aria-valuetext', '1,234.5');
    expect(screen.getByText('Minimum 0')).toBeInTheDocument();
    expect(screen.getByText('Cap 2,000')).toBeInTheDocument();
  });

  it('copiar: "Copy" → "Copied"; una verificación en vivo que no está en curso se nombra con su texto', async () => {
    await english();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.resolve() } });
    render(
      <>
        <CopyField value="tc_live_123" label="Copy key" />
        <FormField label="Email" status={{ tone: 'success', text: 'Available' }} />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    expect(screen.getByLabelText('Available')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('PageLoader con su propio texto', () => {
    render(<PageLoader text="Preparando la cámara" />);
    expect(screen.getByRole('status')).toHaveTextContent('Preparando la cámara');
  });

  it('gráfica de columnas: resumen y tabla en inglés (días por omisión)', async () => {
    await english();
    const days = [
      { day: 'Oct 1', a: 1200 },
      { day: 'Oct 2', a: 300 },
    ];
    const { container } = render(<ColumnChart title="Requests per day" items={days} itemKey={(d) => d.day} itemLabel={(d) => d.day} series={[{ key: 'a', label: 'Requests', value: (d) => d.a }]} format={String} />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Requests per day. 2 days. Total Requests: 1500. Maximum per day: 1200.');
    expect(container.querySelector('thead th')).toHaveTextContent('Day');
  });

  it('el idioma cambia con el campo abierto: el número escrito se conserva', async () => {
    function NumberHarness() {
      const [value, setValue] = useState('');
      return <NumberField label="Radio" value={value} onChange={setValue} />;
    }
    render(<NumberHarness />);
    fireEvent.change(screen.getByLabelText('Radio'), { target: { value: '250' } });
    await act(() => english());
    expect(screen.getByLabelText('Radio')).toHaveValue('250');
    expect(screen.getByRole('button', { name: 'Increase' })).toBeInTheDocument();
  });
});
