import { Ban, Code2, KeyRound, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { apiKeySecretMessage } from '../../components/integrations/apiKeySecret';
import { ConfirmDialog } from '../../components/Modal';
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
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';

type Pending = { kind: 'rotate' | 'revoke'; key: ApiKey } | null;

/** Base de la API de integración (mismo dominio de la aplicación). */
function integrationBaseUrl(origin = window.location.origin): string {
  return `${origin}/api/integrations/v1`;
}

/** Una llave: nombre, cómo reconocerla, quién la creó, su uso, vigencia, permisos y acciones. */
function ApiKeyRow({ apiKey, busy, onAsk }: { apiKey: ApiKey; busy: boolean; onAsk: (pending: Pending) => void }) {
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
          <Button size="sm" variant="secondary" icon={<RefreshCw size={16} />} disabled={busy} onClick={() => onAsk({ kind: 'rotate', key: apiKey })}>
            Rotar
          </Button>
          <Button size="sm" variant="danger-outline" icon={<Ban size={16} />} disabled={busy} onClick={() => onAsk({ kind: 'revoke', key: apiKey })}>
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
  const [pending, setPending] = useState<Pending>(null);
  const action = useAction();
  const busy = action.busy !== null;

  // La confirmación solo existe mientras hay una llave elegida: recibe esa llave (nunca "ninguna").
  const confirm = ({ kind, key }: NonNullable<Pending>) => {
    const rotating = kind === 'rotate';
    void action.run(
      async () => {
        // Rotar: el secreto nuevo se muestra una sola vez, en su propio popup (no un aviso de éxito).
        if (rotating) void feedback.show(apiKeySecretMessage(await apiKeyService.rotate(key.id), true));
        else await apiKeyService.revoke(key.id);
      },
      {
        errorTitle: rotating ? 'No se pudo rotar la llave' : 'No se pudo revocar la llave',
        success: rotating ? undefined : ['Llave revocada', `«${key.name}» dejó de funcionar. El sistema que la usaba ya no puede conectarse.`],
        onSuccess: list.retry,
        onSettled: () => setPending(null),
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
                  <ApiKeyRow key={apiKey.id} apiKey={apiKey} busy={busy} onAsk={setPending} />
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

      {pending && (
        <ConfirmDialog
          open
          title={pending.kind === 'rotate' ? `Rotar «${pending.key.name}»` : `Revocar «${pending.key.name}»`}
          message={
            pending.kind === 'rotate'
              ? 'Se generará una llave nueva con los mismos permisos y vigencia, y la actual dejará de funcionar de inmediato. Tendrás que actualizarla en el sistema que se conecta.'
              : 'La llave dejará de funcionar de inmediato y el sistema que la usa ya no podrá conectarse. No se puede deshacer.'
          }
          confirmLabel={pending.kind === 'rotate' ? 'Rotar llave' : 'Revocar llave'}
          tone="danger"
          loading={busy}
          onConfirm={() => confirm(pending)}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
