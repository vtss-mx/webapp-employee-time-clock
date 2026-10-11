import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOCALES, setLocale, t } from '../../i18n';
import { sampleVerificationDetail } from '../../test/fixtures';
import { localizedCatalogs } from '../../test/fakeApi/catalogs';
import { createCatalogApi } from '../../utils/catalogs';
import { WithCatalogs, renderWithProviders } from '../../test/render';
import { VerificationEvidence } from './VerificationEvidence';

describe('evidencia real del intento', () => {
  it.each(LOCALES)('en %s conserva orden, ceros y valores históricos sin consultar la política', async (locale) => {
    await setLocale(locale);
    const catalogs = createCatalogApi(localizedCatalogs(locale));
    renderWithProviders(<VerificationEvidence detail={{ ...sampleVerificationDetail, trace_id: 'trace-example', kiosk_id: 4, api_key_prefix: 'tck_example', match_thresholds: { fused: 0, sface: 0.81 }, challenge_actions: ['LOOK_UP', 'TURN_LEFT', 'LOOK_UP'], model_name: 'dual-model', policy_version: 'policy-old' }} />, { catalogs });
    expect(screen.getByText(t('verification.detail.traceId'))).toBeVisible();
    expect(screen.getByText('trace-example')).toBeVisible();
    expect(screen.getByText('tck_example')).toBeVisible();
    expect(screen.getByText('policy-old')).toBeVisible();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['LOOK_UP', 'TURN_LEFT', 'LOOK_UP'].map((code) => catalogs.nameOf('liveness_actions', code))); 
    expect(screen.getByText('fused').parentElement).toHaveTextContent('0');
  });

  it('un registro anterior o QR no recibe evidencias inventadas', () => {
    const { rerender } = renderWithProviders(<VerificationEvidence detail={sampleVerificationDetail} />);
    expect(screen.getAllByText(t('verification.detail.evidenceMissing'))).toHaveLength(8);
    rerender(<WithCatalogs><VerificationEvidence detail={{ ...sampleVerificationDetail, trace_id: null, kiosk_id: null, api_key_prefix: null, match_thresholds: null, challenge_actions: null, model_name: null, policy_version: null }} /></WithCatalogs>);
    expect(screen.getAllByText(t('verification.detail.evidenceMissing'))).toHaveLength(8);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('conserva evidencia vacía emitida sin inferir movimientos', () => {
    renderWithProviders(<VerificationEvidence detail={{ ...sampleVerificationDetail, challenge_actions: [], match_thresholds: {} }} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});


describe('evidencia del orquestador', () => {
  it.each(LOCALES)('en %s muestra las etapas sin interpretar PASS como identidad aprobada', async (locale) => {
    await setLocale(locale);
    renderWithProviders(<VerificationEvidence detail={{ ...sampleVerificationDetail, success: false, flow_trace: {
      version: 'ivp-verification-1', method: 'FACE', session_id: 'private-session', policy_version: 'historical-policy',
      modules: [
        { code: 'CAPTURE', status: 'PASS', mandatory: true, duration_ms: 0, reason: null, score: 0, version: 'ivp-verification-1' },
        { code: 'MATCH', status: 'ERROR', mandatory: true, duration_ms: 10, reason: 'TECHNICAL_ERROR', score: null, version: 'ivp-verification-1' },
        { code: 'WEIGHTED_RISK', status: 'SKIPPED_BY_POLICY', mandatory: false, duration_ms: 0, reason: null, score: null, version: 'ivp-verification-1' },
      ],
      capture_manifest: [{ kind: 'FRONTAL', index: 0, sha256: 'a'.repeat(64), bytes: 1024 ** 2 }],
    } }} />);
    expect(screen.getByText(t('verification.detail.flow.title'))).toBeVisible();
    expect(screen.getByText(t('verification.detail.flow.policy', { value: 'historical-policy' }))).toBeVisible();
    expect(screen.getByText(t('verification.detail.flow.score', { value: '0' }))).toBeVisible();
    const stages = screen.getAllByRole('listitem');
    expect(stages[0]).toHaveTextContent(t('verification.detail.flow.modules.CAPTURE'));
    expect(stages[1]).toHaveTextContent(t('verification.detail.flow.statuses.ERROR'));
    expect(stages[2]).toHaveTextContent(t('verification.detail.flow.optional'));
    expect(screen.getByText(/MB/)).toBeVisible();
    expect(screen.queryByText('private-session')).not.toBeInTheDocument();
    expect(screen.queryByText('a'.repeat(64))).not.toBeInTheDocument();
    expect(screen.queryByText(t('verification.result.self.title'))).not.toBeInTheDocument();
  });
  it('cambia el idioma con las etapas montadas y conserva la evidencia', async () => {
    renderWithProviders(<VerificationEvidence detail={{ ...sampleVerificationDetail, flow_trace: {
      version: 'ivp-verification-1', method: 'FACE', session_id: null, policy_version: 'historical-policy',
      modules: [{ code: 'MATCH', status: 'ERROR', mandatory: true, duration_ms: 0, reason: null, score: null, version: 'ivp-verification-1' }], capture_manifest: [],
    } }} />);
    const initial = t('verification.detail.flow.title');
    expect(screen.getByText(initial)).toBeVisible();
    await act(() => setLocale('en-US'));
    expect(screen.getByText(t('verification.detail.flow.title'))).toBeVisible();
    expect(screen.queryByText(initial)).not.toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(t('verification.detail.flow.statuses.ERROR'));
    expect(screen.getByText(t('verification.detail.flow.policy', { value: 'historical-policy' }))).toBeVisible();
  });
  it('una evidencia vacía se conserva sin inventar etapas', () => {
    renderWithProviders(<VerificationEvidence detail={{ ...sampleVerificationDetail, flow_trace: { version: 'ivp-verification-1', method: 'QR', session_id: null, policy_version: 'old', modules: [], capture_manifest: [] } }} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
