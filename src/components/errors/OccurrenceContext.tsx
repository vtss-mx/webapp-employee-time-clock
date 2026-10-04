import type { ErrorContext } from '../../types';

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
  if (client) return `Aplicación web: ${client.path}`;
  if (!request) return `Registrado por ${logger ?? 'el backend'}${fn ? ` (${fn})` : ''}`;
  const status = response ? ` → ${response.status}` : '';
  const time = ms != null ? ` · ${ms} ms` : '';
  return `${request.method ?? ''} ${request.path ?? ''}${status}${time}`.trim();
}

/** Quién, de qué empresa y desde qué IP. */
function whoOf({ user, company_id: company, request, client }: ErrorContext): string {
  const account = user ? `${user.email ?? `Cuenta #${user.id}`} · ${user.role ?? 'sin rol'}` : 'Sin sesión';
  const ip = request?.ip ?? client?.ip;
  return [account, company != null && `Empresa #${company}`, ip && `IP ${ip}`].filter(Boolean).join(' · ');
}

/**
 * Contexto literal de una ocurrencia (para el ADMIN): quién, qué pidió (método, URL, encabezados,
 * cuerpo) y qué se le respondió; de una falla de la app web, lo que contó el navegador (pantalla,
 * componente, versión y navegador). Los secretos llegan como «[oculto]» y los archivos solo con su
 * nombre, tipo y tamaño (lo decide el backend). Plegado: se abre solo cuando hace falta.
 */
export function OccurrenceContext({ context }: { context: ErrorContext }) {
  const { request, response, client } = context;
  return (
    <details className="occurrence-context">
      <summary>
        Contexto: <code>{summaryOf(context)}</code>
      </summary>
      <p className="small">{whoOf(context)}</p>
      {request && (
        <>
          {request.query && <Block title="Parámetros de la URL" value={request.query} />}
          {request.headers && <Block title="Encabezados" value={request.headers} />}
          <Block title={`Cuerpo de la petición${request.body_truncated ? ' (cortado)' : ''} · ${request.body_bytes ?? 0} bytes`} value={request.body ?? null} />
        </>
      )}
      {response && <Block title={`Respuesta (${response.status})`} value={response.body} />}
      {client && <Block title="Aplicación web" value={client} />}
      {!request && !client && <Block title="Dónde" value={{ logger: context.logger, thread: context.thread, function: context.function }} />}
    </details>
  );
}
