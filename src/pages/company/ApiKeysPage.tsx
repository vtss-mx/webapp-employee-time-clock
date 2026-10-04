import { Ban, Code2, KeyRound, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiKeySecretMessage } from '../../components/integrations/apiKeySecret';
import { ApiKeyStatusBadge } from '../../components/StatusBadge';
import { Button, ButtonLink } from '../../components/ui/Button';
import { CopyField } from '../../components/ui/CopyField';
import { PagedItems } from '../../components/ui/PagedItems';
import { Panel, PanelFooter, PanelHeader, PanelSection } from '../../components/ui/Panel';
import { useAction } from '../../hooks/useAction';
import { useCatalogs } from '../../hooks/useCatalogs';
import { useFeedback } from '../../hooks/useFeedback';
import { usePagedList } from '../../hooks/usePagedList';
import { paths } from '../../routes/paths';
import { apiKeyService } from '../../services/apiKeyService';
import type { ApiKey } from '../../types';
import type { ConfirmDetail, ConfirmInput } from '../../types/confirm';
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';

type KeyAction = 'rotate' | 'revoke';
/** Qué llave se está procesando y con qué botón (cada uno muestra su propio "ocupado"). */
type Busy = `${KeyAction}:${number}`;

/** Base de la API de integración (mismo dominio de la aplicación). */
function integrationBaseUrl(origin = window.location.origin): string {
  return `${origin}/api/integrations/v1`;
}

/** La llave en la confirmación: cómo reconocerla, qué permite y si se está usando. */
function keyDetails(key: ApiKey, scopeName: (scope: string) => string): ConfirmDetail[] {
  return [
    { label: 'Llave', value: `${key.prefix}…` },
    { label: 'Permisos', value: key.scopes.map((scope) => scopeName(scope)).join(', ') },
    { label: 'Último uso', value: key.last_used_at ? timeAgo(key.last_used_at) : 'Aún sin usar' },
  ];
}

/** Rotar (una llave nueva con los mismos permisos; la actual deja de servir) o revocar (no se deshace). */
function keyConfirm(kind: KeyAction, key: ApiKey, details: ConfirmDetail[]): ConfirmInput {
  return kind === 'rotate'
    ? {
        tone: 'warning',
        icon: <RefreshCw size={30} />,
        eyebrow: 'Rotar llave',
        title: `¿Rotar «${key.name}»?`,
        message: 'Se generará una llave nueva con los mismos permisos y vigencia. Tendrás que actualizarla en el sistema que se conecta.',
        details,
        note: 'La llave actual dejará de funcionar de inmediato.',
        confirmLabel: 'Rotar llave',
        confirmIcon: <RefreshCw size={18} />,
      }
    : {
        tone: 'danger',
        icon: <Ban size={30} />,
        eyebrow: 'Revocar llave',
        title: `¿Revocar «${key.name}»?`,
        message: 'La llave dejará de funcionar de inmediato y el sistema que la usa ya no podrá conectarse.',
        details,
        note: 'Esta acción no se puede deshacer.',
        confirmLabel: 'Revocar llave',
        confirmIcon: <Ban size={18} />,
      };
}

/** Una llave: nombre, cómo reconocerla, quién la creó, su uso, vigencia, permisos y acciones. */
function ApiKeyRow({ apiKey, busy, onAction }: { apiKey: ApiKey; busy: Busy | null; onAction: (kind: KeyAction, key: ApiKey) => void }) {
  const { nameOf } = useCatalogs();
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
          Creada {formatDate(apiKey.created_at)}
          {apiKey.created_by && ` por ${apiKey.created_by}`} · {apiKey.expires_at ? `Vence ${formatDate(apiKey.expires_at)}` : 'Sin vencimiento'}
        </small>
        <small className="muted truncate" title={apiKey.last_used_at ? formatDateTime(apiKey.last_used_at) : undefined}>
          {apiKey.last_used_at ? `Último uso ${timeAgo(apiKey.last_used_at)}${apiKey.last_used_ip ? ` · IP ${apiKey.last_used_ip}` : ''}` : 'Aún sin usar'}
        </small>
        {apiKey.revoked_at && (
          <small className="muted truncate">
            Revocada {formatDateTime(apiKey.revoked_at)}
            {apiKey.revoked_by && ` por ${apiKey.revoked_by}`}
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
            Rotar
          </Button>
          <Button size="sm" variant="danger-outline" icon={<Ban size={16} />} loading={busy === `revoke:${apiKey.id}`} disabled={busy !== null} onClick={() => onAction('revoke', apiKey)}>
            Revocar
          </Button>
        </span>
      )}
    </li>
  );
}

/** Cómo se conecta un sistema: URL base, cabecera, ejemplo y qué permite cada permiso (catálogo). */
function ConnectionGuide() {
  const { active } = useCatalogs();
  const base = integrationBaseUrl();
  return (
    <div className="api-guide">
      <div className="field">
        <span className="api-guide__label">URL base</span>
        <CopyField value={base} label="Copiar URL base" />
      </div>
      <div className="field">
        <span className="api-guide__label">Ejemplo (consulta tu empresa y tu llave)</span>
        <CopyField value={`curl -H "X-API-Key: tck_…" ${base}/company`} label="Copiar ejemplo" multiline />
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
          Respuestas en JSON con el mismo formato de la aplicación; listados paginados con <code>page</code> y <code>size</code> (máximo 50).
        </li>
        <li>Fechas en UTC (ISO 8601); los días de tu empresa se cuentan en la hora del Centro.</li>
        <li>Cada llave tiene un límite de peticiones por minuto (responde 429 si se excede).</li>
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
  const feedback = useFeedback();
  const list = usePagedList((page, signal) => apiKeyService.list(page, signal), { errorTitle: 'No se pudieron cargar las llaves' });
  const { nameOf } = useCatalogs();
  const action = useAction<Busy>();

  // Rotar y revocar preguntan antes (cancelar no envía nada); el botón de esa llave queda ocupado.
  const act = (kind: KeyAction, key: ApiKey) => {
    const rotating = kind === 'rotate';
    void action.run(
      async () => {
        // Rotar: el secreto nuevo se muestra una sola vez, en su propio popup (no un aviso de éxito).
        if (rotating) void feedback.show(apiKeySecretMessage(await apiKeyService.rotate(key.id), true));
        else await apiKeyService.revoke(key.id);
      },
      {
        busy: `${kind}:${key.id}`,
        confirm: keyConfirm(kind, key, keyDetails(key, (scope) => nameOf('api_scopes', scope))),
        errorTitle: rotating ? 'No se pudo rotar la llave' : 'No se pudo revocar la llave',
        success: rotating ? undefined : ['Llave revocada', `«${key.name}» dejó de funcionar. El sistema que la usaba ya no puede conectarse.`],
        onSuccess: list.retry,
      },
    );
  };

  const createButton = (
    <ButtonLink to={paths.company.newApiKey} variant="primary" icon={<Plus size={18} />}>
      Crear llave
    </ButtonLink>
  );

  return (
    <div className="page">
      <Panel>
        <PanelHeader
          title="Integraciones (API)"
          subtitle="Conecta los sistemas de tu empresa (nómina, ERP, control de acceso) con su información, de forma segura."
          actions={createButton}
        />
        <PanelSection>
          <PagedItems
            list={list}
            skeletonRows={3}
            empty={{
              icon: <KeyRound />,
              title: 'No hay llaves de la API',
              description: 'Crea una llave para cada sistema que se conectará: solo podrá leer la información de tu empresa con los permisos que elijas.',
              action: createButton,
            }}
            pager={{ noun: { one: 'llave', other: 'llaves' } }}
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
        <PanelSection title="Cómo conectarse" icon={<Code2 size={20} />}>
          <ConnectionGuide />
        </PanelSection>
        <PanelFooter align="center">
          <p className="inline-note small muted">
            <ShieldCheck size={16} color="var(--success)" /> Cada llave solo accede a la información de tu empresa, en modo de solo lectura y
            nunca a fotos ni datos biométricos.
          </p>
        </PanelFooter>
      </Panel>
    </div>
  );
}
