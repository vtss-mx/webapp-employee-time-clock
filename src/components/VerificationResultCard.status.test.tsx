import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale, t } from '../i18n';
import { identifiedResult } from '../test/fixtures';
import { testCatalogs } from '../test/catalogs';
import { localizedCatalogs } from '../test/fakeApi/catalogs';
import { createCatalogApi } from '../utils/catalogs';
import { WithCatalogs, renderWithProviders } from '../test/render';
import { VerificationResultCard } from './VerificationResultCard';

describe('el resultado no concede identidad fuera de APPROVED', () => {
  it.each(['REJECTED', 'MANUAL_REVIEW', 'INCONCLUSIVE', 'TECHNICAL_ERROR', 'RETRY_REQUIRED', 'BLOCKED', 'EXPIRED', 'FUTURE_STATUS'])('protege la pantalla aunque verified llegue incoherente: %s', (status) => {
    renderWithProviders(<VerificationResultCard result={{ ...identifiedResult, verification_status: status }} failureTitle={t('verification.detail.evidenceMissing')} onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument();
    expect(screen.getByRole('heading')).toHaveTextContent(testCatalogs.nameOf('verification_statuses', status));
    const retry = screen.queryByRole('button', { name: t('verification.result.retry') });
    expect(Boolean(retry)).toBe(['REJECTED', 'TECHNICAL_ERROR', 'RETRY_REQUIRED', 'EXPIRED'].includes(status));
  });

  it.each(LOCALES)('revisión manual usa el nombre recibido del servidor en %s', async (locale) => {
    await setLocale(locale);
    const catalogs = createCatalogApi(localizedCatalogs(locale));
    renderWithProviders(<VerificationResultCard result={{ ...identifiedResult, verified: false, review: true, verification_status: 'MANUAL_REVIEW' }} failureTitle={t('verification.detail.evidenceMissing')} onRetry={vi.fn()} onBack={vi.fn()} />, { catalogs });
    expect(screen.getByRole('heading')).toHaveTextContent(catalogs.nameOf('verification_statuses', 'MANUAL_REVIEW'));
    expect(screen.queryByRole('button', { name: t('verification.result.retry') })).not.toBeInTheDocument();
  });

  it('APPROVED necesita verified y no review; conserva los detalles aprobados', () => {
    const { rerender } = renderWithProviders(<VerificationResultCard result={{ ...identifiedResult, verification_status: 'APPROVED' }} failureTitle={t('verification.detail.evidenceMissing')} onRetry={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByText('Ana Ruiz')).toBeVisible();
    rerender(<WithCatalogs><VerificationResultCard result={{ ...identifiedResult, verification_status: 'APPROVED', review: true }} failureTitle={t('verification.detail.evidenceMissing')} onRetry={vi.fn()} onBack={vi.fn()} /></WithCatalogs>);
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument();
  });
});
