import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOCALES, setLocale, t } from '../i18n';
import { LegalNoticesLink } from './LegalNoticesLink';

describe('acceso legal visible y accesible', () => {
  it.each(LOCALES)('en %s enlaza el archivo servido y conserva los textos legales originales', async (locale) => {
    await setLocale(locale);
    render(<LegalNoticesLink />);
    const link = screen.getByRole('link', { name: t('app.thirdPartyNotices') });
    expect(link).toHaveAttribute('href', '/third-party-notices.txt');
    expect(link).not.toHaveAttribute('target');
    link.focus();
    expect(link).toHaveFocus();
    expect(screen.getByText('VT Software Solutions')).toBeVisible();
  });

  it('el cambio de idioma actualiza el enlace sin reemplazarlo ni perder su foco', async () => {
    render(<LegalNoticesLink />);
    const link = screen.getByRole('link');
    fireEvent.focus(link);
    link.focus();
    await act(() => setLocale('en-US'));
    expect(screen.getByRole('link', { name: 'Third-party notices' })).toBe(link);
    expect(link).toHaveFocus();
  });
});
