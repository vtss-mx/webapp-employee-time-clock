import { useCallback } from 'react';
import { useAction } from '../../hooks/useAction';
import { ApiError } from '../../services/apiClient';
import { reportService } from '../../services/reportService';
import type { ReportPlan, SavedReport } from '../../types';
import { saveFile } from '../../utils/download';

/** Intentos de nombre único al guardar: «Asistencia», «Asistencia (2)», «Asistencia (3)»... */
const NAME_ATTEMPTS = 5;

/** Guarda con el nombre pedido; si ya existe uno igual, con «(2)», «(3)»... */
export async function saveWithUniqueName(name: string, plan: ReportPlan, question: string | null, queryId: number | null): Promise<SavedReport> {
  const base = name.trim().slice(0, 90) || 'Reporte';
  for (let attempt = 1; ; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base} (${attempt})`;
    try {
      return await reportService.save(candidate, plan, question, queryId);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'REPORT_NAME_TAKEN') || attempt >= NAME_ATTEMPTS) throw error;
    }
  }
}

/** Exportar a Excel y guardar un reporte: lo mismo desde el asistente, el constructor o lo guardado. */
export function useReportActions(onSaved?: () => void) {
  const { busy, run } = useAction<string>();

  const exportPlan = useCallback(
    (plan: ReportPlan, queryId: number | null, question: string | null, key = 'export') =>
      run(async () => saveFile(await reportService.exportExcel(plan, queryId, question), 'reporte.xlsx'), {
        busy: key,
        errorTitle: 'No se pudo generar el archivo de Excel',
      }),
    [run],
  );

  const save = useCallback(
    (name: string, plan: ReportPlan, question: string | null, queryId: number | null, key = 'save') =>
      run(() => saveWithUniqueName(name, plan, question, queryId), {
        busy: key,
        errorTitle: 'No se pudo guardar el reporte',
        success: (report) => ['Reporte guardado', `«${report.name}» quedó en tus reportes guardados: genéralo de nuevo cuando quieras.`],
        onSuccess: () => onSaved?.(),
      }),
    [run, onSaved],
  );

  return { busy, exportPlan, save };
}
