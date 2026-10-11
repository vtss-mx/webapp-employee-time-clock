import { useCallback, useState } from 'react';
import { t } from '../i18n';
import { auditService } from '../services/auditService';
import type { AuditEvent, AuditFilters } from '../types/audit';
import type { ConfirmInput } from '../types/confirm';
import { AUDIT_EXPORT_MAX_CHUNKS, auditFileName } from '../utils/audit';
import { saveFile } from '../utils/download';
import { formatCount } from '../utils/numbers';
import { useAction, type SuccessNotice } from './useAction';

/** Lo que se juntó de todos los tramos: los eventos, el periodo real y si el servidor ya no tenía más. */
interface Collected {
  items: AuditEvent[];
  since: string;
  until: string;
  complete: boolean;
}

/** Avance de la exportación: en qué tramo va y cuántos eventos lleva (la pantalla lo muestra mientras corre). */
export interface ExportProgress {
  chunk: number;
  events: number;
}

/** Qué se va a exportar y por qué se pregunta antes: es una lectura grande y queda registrada en la bitácora misma. */
function exportConfirm(filtered: boolean): ConfirmInput {
  return {
    kind: 'action',
    eyebrow: t('audit.exportAsk.eyebrow'),
    title: t('audit.exportAsk.title'),
    message: t(filtered ? 'audit.exportAsk.filtered' : 'audit.exportAsk.message'),
    note: t('audit.exportAsk.note'),
    confirmLabel: t('audit.exportAsk.confirm'),
  };
}

/**
 * Junta los tramos del periodo: el servidor entrega la bitácora por CURSOR (no por página), así que bajar un año
 * cuesta lo mismo en el primer tramo que en el último. `AUDIT_EXPORT_MAX_CHUNKS` es la red de seguridad para no
 * encadenar peticiones sin fin si un servidor devolviera siempre el mismo cursor.
 */
async function collect(filters: AuditFilters, onChunk: (progress: ExportProgress) => void, signal?: AbortSignal): Promise<Collected> {
  const items: AuditEvent[] = [];
  let cursor: string | null = null;
  let since = '';
  let until = '';
  for (let chunk = 1; chunk <= AUDIT_EXPORT_MAX_CHUNKS; chunk++) {
    const tramo = await auditService.exportChunk(filters, cursor, signal);
    items.push(...tramo.items);
    since = since || tramo.since;
    until = tramo.until;
    onChunk({ chunk, events: items.length });
    if (!tramo.next_cursor) return { items, since, until, complete: true };
    cursor = tramo.next_cursor;
  }
  return { items, since, until, complete: false };
}

/** El aviso al terminar: cuántos eventos se llevó, o que el periodo no tenía ninguno. */
function notice(result: Collected, fileName: string): SuccessNotice {
  if (result.items.length === 0) return [t('audit.exportEmpty'), t('audit.exportEmptyText')];
  const text = t('audit.exportedText', { count: result.items.length, file: fileName });
  return [t('audit.exported'), result.complete ? text : `${text} ${t('audit.exportTruncated', { count: AUDIT_EXPORT_MAX_CHUNKS })}`];
}

/**
 * Exportar la bitácora del periodo para el auditor: pregunta antes (es una lectura grande y queda registrada en la
 * bitácora misma), pide los tramos hasta que el servidor ya no tenga más, relata el avance mientras corre y
 * descarga UN archivo JSON con lo que la pantalla estaba mostrando. Un periodo sin eventos no descarga nada: lo
 * dice (si no, no pasaría nada visible).
 */
export function useAuditExport(filters: AuditFilters, filtered: boolean) {
  const action = useAction();
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const run = useCallback(() => {
    setProgress(null);
    return action.run(
      async () => {
        const result = await collect(filters, setProgress);
        const fileName = auditFileName(result.since, result.until);
        if (result.items.length > 0) {
          saveFile(new Blob([JSON.stringify({ since: result.since, until: result.until, events: result.items }, null, 2)], { type: 'application/json' }), fileName);
        }
        return { result, fileName };
      },
      {
        confirm: () => exportConfirm(filtered),
        errorTitle: () => t('audit.exportError'),
        success: ({ result, fileName }) => notice(result, fileName),
        onSettled: () => setProgress(null),
      },
    );
  }, [action, filters, filtered]);

  /** Lo que dice el botón mientras corre: en qué tramo va y cuántos eventos lleva. */
  const label = progress ? t('audit.exporting', { chunk: formatCount(progress.chunk), count: progress.events }) : t('audit.export');
  return { run, busy: action.busy !== null, label };
}
