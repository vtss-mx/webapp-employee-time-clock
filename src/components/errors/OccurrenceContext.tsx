import { t, Trans, useT } from '../../i18n';
import type { ErrorContext } from '../../types';
import { formatCount } from '../../utils/numbers';

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** Una sección del contexto: su título y su contenido literal (JSON con sangría). */
function Block({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="occurrence-context__block">
      <span className="small muted">{title}</span>
      <pre className="code-block">{json(value)}</pre>
    </div>
  );
}

/** «POST /api/employees → 500 · 12 ms», la pantalla de la app web, o dónde lo registró el log. */
function summaryOf({ request, response, duration_ms: ms, logger, function: fn, client }: ErrorContext): string {
  if (client) return t('systemErrors.context.client', { path: client.path });
  if (!request) {
    const by = logger ?? t('systemErrors.context.backend');
    return fn ? t('systemErrors.context.loggedByIn', { logger: by, fn }) : t('systemErrors.context.loggedBy', { logger: by });
  }
  const status = response ? ` → ${response.status}` : '';
  const time = ms != null ? ` · ${ms} ms` : '';
  return `${request.method ?? ''} ${request.path ?? ''}${status}${time}`.trim();
}

/** Quién, de qué empresa y desde qué IP. */
function whoOf({ user, company_id: company, request, client }: ErrorContext): string {
  const account = user
    ? `${user.email ?? t('systemErrors.context.account', { id: user.id })} · ${user.role ?? t('systemErrors.context.noRole')}`
    : t('systemErrors.detail.noSession');
  const ip = request?.ip ?? client?.ip;
  return [account, company != null && t('systemErrors.context.company', { id: company }), ip && t('systemErrors.context.ip', { ip })].filter(Boolean).join(' · ');
}

/**
 * Contexto literal de una ocurrencia (para el ADMIN): quién, qué pidió (método, URL, encabezados,
 * cuerpo) y qué se le respondió; de una falla de la app web, lo que contó el navegador (pantalla,
 * componente, versión y navegador). Los secretos llegan como «[oculto]» y los archivos solo con su
 * nombre, tipo y tamaño (lo decide el backend). Plegado: se abre solo cuando hace falta.
 */
export function OccurrenceContext({ context }: { context: ErrorContext }) {
  const t = useT();
  const { request, response, client } = context;
  return (
    <details className="occurrence-context">
      <summary>
        <Trans k="systemErrors.context.summary" values={{ summary: <code>{summaryOf(context)}</code> }} />
      </summary>
      <p className="small">{whoOf(context)}</p>
      {request && (
        <>
          {request.query && <Block title={t('systemErrors.context.query')} value={request.query} />}
          {request.headers && <Block title={t('systemErrors.context.headers')} value={request.headers} />}
          <Block
            title={t(request.body_truncated ? 'systemErrors.context.bodyCut' : 'systemErrors.context.body', { bytes: formatCount(request.body_bytes ?? 0) })}
            value={request.body ?? null}
          />
        </>
      )}
      {response && <Block title={t('systemErrors.context.response', { status: response.status })} value={response.body} />}
      {client && <Block title={t('systemErrors.context.app')} value={client} />}
      {!request && !client && <Block title={t('systemErrors.list.where')} value={{ logger: context.logger, thread: context.thread, function: context.function }} />}
    </details>
  );
}
