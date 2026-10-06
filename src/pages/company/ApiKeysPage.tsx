import { Ban, Code2, KeyRound, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiKeySecretMessage } from '../../components/integrations/apiKeySecret';
import { ApiKeyStatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { CopyField } from '../../components/ui/CopyField';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useAction, type SuccessNotice } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { usePagedList } from '../../hooks/usePagedList';
import { t, Trans, useT } from '../../i18n';
import { paths } from '../../routes/paths';
import { apiKeyService } from '../../services/apiKeyService';
import type { ApiKey } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';

type KeyAction = 'rotate' | 'revoke';
/** Qué llave se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${KeyAction}:${number}`;

/** Parámetros de paginación de la API (código: iguales en todos los idiomas). */
const PAGE_PARAM = 'page';
const SIZE_PARAM = 'size';

/** Base de la API de integración (mismo dominio de la aplicación). */
function integrationBaseUrl(origin = window.location.origin): string {
  return `${origin}/api/integrations/v1`;
}

/** La llave en la confirmación: cómo reconocerla, qué permite y si se está usando. */
function keyDetails(key: ApiKey, scopeName: (scope: string) => string): ConfirmDetail[] {
  return [
    { label: t('apiKeys.details.key'), value: `${key.prefix}…` },
    { label: t('apiKeys.details.scopes'), value: key.scopes.map((scope) => scopeName(scope)).join(', ') },
    { label: t('apiKeys.details.lastUsed'), value: key.last_used_at ? timeAgo(key.last_used_at) : t('apiKeys.row.neverUsed') },
  ];
}

/** Rotar (una llave nueva con los mismos permisos; la actual deja de servir) o revocar (no se deshace). */
function keyConfirm(kind: KeyAction, key: ApiKey, details: ConfirmDetail[]): ConfirmInput {
  return kind === 'rotate'
    ? {
        tone: 'warning',
        icon: <RefreshCw size={30} />,
        eyebrow: t('apiKeys.rotate.eyebrow'),
        title: t('apiKeys.rotate.title', { name: key.name }),
        message: t('apiKeys.rotate.message'),
        details,
        note: t('apiKeys.rotate.note'),
        confirmLabel: t('apiKeys.rotate.confirm'),
        confirmIcon: <RefreshCw size={18} />,
      }
    : {
        tone: 'danger',
        icon: <Ban size={30} />,
        eyebrow: t('apiKeys.revoke.eyebrow'),
        title: t('apiKeys.revoke.title', { name: key.name }),
        message: t('apiKeys.revoke.message'),
        details,
        note: t('common.notes.irreversible'),
        confirmLabel: t('apiKeys.revoke.confirm'),
        confirmIcon: <Ban size={18} />,
      };
}

/** Último uso de la llave (con la IP si se conoce) o "Aún sin usar". */
function lastUse(key: ApiKey): string {
  if (!key.last_used_at) return t('apiKeys.row.neverUsed');
  const ago = timeAgo(key.last_used_at);
  return key.last_used_ip ? t('apiKeys.row.lastUsedFrom', { ago, ip: key.last_used_ip }) : t('apiKeys.row.lastUsed', { ago });
}

/** Avisos de rotar y revocar: se arman al dibujarse (el popup abierto sigue al idioma activo). */
const loadError = () => t('apiKeys.list.loadError');
const actionError = (kind: KeyAction) => () => t(kind === 'rotate' ? 'apiKeys.rotate.error' : 'apiKeys.revoke.error');
const revokedNotice = (key: ApiKey): SuccessNotice => [t('apiKeys.revoke.done'), t('apiKeys.revoke.doneText', { name: key.name })];

/** Una llave: nombre, cómo reconocerla, quién la creó, su uso, vigencia, permisos y acciones. */
function ApiKeyRow({ apiKey, busy, onAction }: { apiKey: ApiKey; busy: Busy | null; onAction: (kind: KeyAction, key: ApiKey) => void }) {
  const t = useT();
  const { nameOf } = useCatalogs();
  const created = formatDate(apiKey.created_at);
  const revoked = formatDateTime(apiKey.revoked_at);
  const usable = apiKey.status !== 'REVOKED';
  return (
    <li>
      <span className="icon-tile">
        <KeyRound size={20} />
      </span>
      <span className="validator-list__info">
        <strong className="truncate">{apiKey.name}</strong>
        <code className="api-key__prefix">{apiKey.prefix}…</code>
        <small className="muted truncate">
          {apiKey.created_by ? t('apiKeys.row.createdBy', { date: created, name: apiKey.created_by }) : t('apiKeys.row.created', { date: created })} ·{' '}
          {apiKey.expires_at ? t('apiKeys.row.expires', { date: formatDate(apiKey.expires_at) }) : t('apiKeys.row.noExpiry')}
        </small>
        <small className="muted truncate" title={apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : undefined}>
          {lastUse(apiKey)}
        </small>
        {apiKey.revoked_at && (
          <small className="muted truncate">
            {apiKey.revoked_by ? t('apiKeys.row.revokedBy', { date: revoked, name: apiKey.revoked_by }) : t('apiKeys.row.revoked', { date: revoked })}
          </small>
        )}
      </span>
      <span className="validator-list__badges">
        <ApiKeyStatusBadge status={apiKey.status} />
        {apiKey.scopes.map((scope) => (
          <span key={scope} className="badge badge--info badge--plain">
            {nameOf('api_scopes', scope)}
          </span>
        ))}
      </span>
      {usable && (
        <span className="validator-list__actions">
          <Button size="sm" variant="secondary" icon={<RefreshCw size={16} />} loading={busy === `rotate:${apiKey.id}`} disabled={busy !== null} onClick={() => onAction('rotate', apiKey)}>
            {t('apiKeys.row.rotate')}
          </Button>
          <Button size="sm" variant="danger-outline" icon={<Ban size={16} />} loading={busy === `revoke:${apiKey.id}`} disabled={busy !== null} onClick={() => onAction('revoke', apiKey)}>
            {t('apiKeys.row.revoke')}
          </Button>
        </span>
      )}
    </li>
  );
}

/** Cómo se conecta un sistema: URL base, cabecera, ejemplo y qué permite cada permiso (catálogo). */
function ConnectionGuide() {
  const t = useT();
  const { active } = useCatalogs();
  const base = integrationBaseUrl();
  return (
    <div className="api-guide">
      <div className="field">
        <span className="api-guide__label">{t('apiKeys.guide.baseUrl')}</span>
        <CopyField value={base} label={t('apiKeys.guide.copyBaseUrl')} />
      </div>
      <div className="field">
        <span className="api-guide__label">{t('apiKeys.guide.example')}</span>
        {/* eslint-disable-next-line i18n/no-hardcoded-text -- comando de ejemplo: es código, igual en todos los idiomas */}
        <CopyField value={`curl -H "X-API-Key: tck_…" ${base}/company`} label={t('apiKeys.guide.copyExample')} multiline />
      </div>
      <dl className="api-guide__scopes">
        {active('api_scopes').map((scope) => (
          <div key={scope.code}>
            <dt>{scope.name}</dt>
            <dd className="muted small">{scope.description}</dd>
          </div>
        ))}
      </dl>
      <ul className="api-guide__notes small muted">
        <li>
          <Trans k="apiKeys.guide.format" values={{ page: <code>{PAGE_PARAM}</code>, size: <code>{SIZE_PARAM}</code> }} />
        </li>
        <li>{t('apiKeys.guide.dates')}</li>
        <li>{t('apiKeys.guide.rateLimit')}</li>
      </ul>
    </div>
  );
}

/**
 * Integraciones (API): llaves con las que los sistemas de la empresa (nómina, ERP, control de
 * acceso) consultan SU información. Cada llave solo lee lo que permiten sus permisos y nunca datos
 * de otra empresa; su secreto se muestra una sola vez.
 */
export function ApiKeysPage() {
  const t = useT();
  const feedback = useFeedback();
  const list = usePagedList((page, signal) => apiKeyService.list(page, signal), { errorTitle: loadError });
  const { nameOf } = useCatalogs();
  const action = useAction<Busy>();

  // Rotar y revocar preguntan antes (cancelar no envía nada); el botón de esa llave queda ocupado.
  const act = (kind: KeyAction, key: ApiKey) => {
    const rotating = kind === 'rotate';
    void action.run(
      async () => {
        // Rotar: el secreto nuevo se muestra una sola vez, en su propio popup (no un aviso de éxito).
        if (rotating) {
          const rotated = await apiKeyService.rotate(key.id);
          void feedback.show(() => apiKeySecretMessage(rotated, true));
        } else {
          await apiKeyService.revoke(key.id);
        }
      },
      {
        busy: `${kind}:${key.id}`,
        confirm: () => keyConfirm(kind, key, keyDetails(key, (scope) => nameOf('api_scopes', scope))),
        errorTitle: actionError(kind),
        success: rotating ? undefined : () => revokedNotice(key),
        onSuccess: list.retry,
      },
    );
  };

  const createButton = (
    <ButtonLink to={paths.company.newApiKey} variant="primary" icon={<Plus size={18} />}>
      {t('apiKeys.list.create')}
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader title={t('apiKeys.list.title')} subtitle={t('apiKeys.list.subtitle')} actions={createButton} />
        <PanelSection>
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <KeyRound />,
              title: t('apiKeys.list.empty.title'),
              description: t('apiKeys.list.empty.description'),
              action: createButton,
            }}
            pager={{ noun: { one: t('apiKeys.list.noun.one'), other: t('apiKeys.list.noun.other') } }}
          >
            {(keys) => (
              <ul className={`validator-list stagger ${list.loading ? 'is-loading' : ''}`}>
                {keys.map((apiKey) => (
                  <ApiKeyRow key={apiKey.id} apiKey={apiKey} busy={action.busy} onAction={act} />
                ))}
              </ul>
            )}
          </PagedItems>
        </PanelSection>
        <PanelSection title={t('apiKeys.guide.title')} icon={<Code2 size={20} />}>
          <ConnectionGuide />
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> {t('apiKeys.list.footer')}
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
