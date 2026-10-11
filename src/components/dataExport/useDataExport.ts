import { useCallback, useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { t } from '../../i18n';
import { dataExportService, type DataExportResult } from '../../services/dataExportService';
import type { ConfirmInput } from '../../types/confirm';
import type { DataExport } from '../../types/dataExport';
import { exportFileName, exportJson } from '../../utils/dataExport';
import { saveFile } from '../../utils/download';
import { exportBlockedNotice } from './dataExportMessages';

/** De quién son los datos: del titular en su sesión o de un empleado de la empresa. */
export type ExportSubject = { kind: 'mine' } | { kind: 'employee'; employeeId: number; name: string };

/**
 * Qué se va a entregar, ANTES de pedirlo (decisión del dueño del producto: nada se pide sin confirmar). Dice lo
 * que lleva, lo que NO lleva y que la entrega queda registrada: una exportación es la lectura más amplia de la
 * plataforma y la persona tiene que saber qué recibe.
 */
function exportConfirm(subject: ExportSubject): ConfirmInput {
  const own = subject.kind === 'mine';
  return {
    kind: 'action',
    eyebrow: t('dataExport.ask.eyebrow'),
    title: own ? t('dataExport.ask.titleMine') : t('dataExport.ask.titleEmployee', { name: subject.name }),
    message: t(own ? 'dataExport.ask.messageMine' : 'dataExport.ask.messageEmployee'),
    detailsTitle: t('dataExport.ask.includes'),
    details: [t('dataExport.ask.account'), t('dataExport.ask.work'), t('dataExport.ask.biometricsExistence')],
    note: t('dataExport.ask.note'),
    confirmLabel: t('dataExport.ask.confirm'),
  };
}

/** El aviso al terminar: cuántas filas se entregaron y, si algo quedó cortado, que hay más historia. */
function notice(data: DataExport): [string, string] {
  const rows = t('dataExport.deliveredRows', { count: data.row_count });
  return [t('dataExport.delivered'), data.truncated ? `${rows} ${t('dataExport.truncatedNotice')}` : rows];
}

/**
 * Pedir la exportación de los datos de una persona (RGPD arts. 15 y 20, derechos ARCO, CCPA; migración 0097):
 * confirma qué se entrega, descarga el JSON y deja en la pantalla el acuse (lo entregado, lo RETENIDO con su
 * motivo, los plazos de retención y cuándo se podrá pedir de nuevo).
 *
 * Los dos rechazos que necesitan su propia explicación (429 `EXPORT_TOO_SOON` con su `Retry-After` y 403
 * `COMPANY_REQUIRED`) se muestran con `exportBlockedNotice` y SIN «Reintentar»: reintentar no podría funcionar.
 * Cualquier otra falla sigue el camino de siempre (popup con el mensaje del servidor).
 */
export function useDataExport(subject: ExportSubject) {
  const action = useAction();
  const [result, setResult] = useState<DataExport | null>(null);

  const run = useCallback(() => {
    const fetchExport = (): Promise<DataExportResult> => (subject.kind === 'mine' ? dataExportService.mine() : dataExportService.employee(subject.employeeId));
    return action.run(fetchExport, {
      confirm: () => exportConfirm(subject),
      errorTitle: () => t('dataExport.failed'),
      // Los dos rechazos que no se pueden reintentar traen su propio aviso (sin «Reintentar»); lo demás, el de siempre.
      errorMessage: exportBlockedNotice,
      onSuccess: ({ data }) => {
        setResult(data);
        saveFile(new Blob([exportJson(data)], { type: 'application/json' }), exportFileName(data));
      },
      success: ({ data }) => notice(data),
    });
  }, [action, subject]);

  return { run, busy: action.busy !== null, result };
}
