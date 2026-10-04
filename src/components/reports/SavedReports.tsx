import { Bookmark, FileSpreadsheet, Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { usePagedList } from '../../hooks/usePagedList';
import { reportService } from '../../services/reportService';
import type { ReportAnswer, SavedReport } from '../../types';
import { timeAgo } from '../../utils/format';
import { ConfirmDialog } from '../Modal';
import { Button } from '../ui/Button';
import { PagedItems } from '../ui/PagedItems';
import { AnswerCard } from './AnswerCard';
import { useReportActions } from './useReportActions';

/**
 * Reportes guardados de la empresa: se vuelven a generar con los datos de hoy (vista previa o
 * Excel) o se borran. `version` cambia al guardar uno nuevo: la lista se recarga.
 */
export function SavedReports({ version }: { version: number }) {
  const list = usePagedList((page, signal) => reportService.saved(page, signal), {
    errorTitle: 'No se pudieron cargar tus reportes guardados',
    filterKey: String(version),
  });
  const action = useAction<string>();
  const report = useReportActions();
  const [result, setResult] = useState<{ report: SavedReport; answer: ReportAnswer } | null>(null);
  const [removing, setRemoving] = useState<SavedReport | null>(null);
  const busy = action.busy ?? report.busy;

  const run = (saved: SavedReport) =>
    void action.run(() => reportService.runSaved(saved.id), {
      busy: `run-${saved.id}`,
      errorTitle: 'No se pudo generar el reporte',
      onSuccess: (answer) => {
        setResult({ report: saved, answer });
        list.retry(); // su contador de veces y la última vez
      },
    });

  const remove = (saved: SavedReport) =>
    void action.run(() => reportService.deleteSaved(saved.id), {
      busy: 'delete',
      errorTitle: 'No se pudo borrar el reporte',
      success: ['Reporte borrado', `«${saved.name}» ya no está en tus reportes guardados.`],
      onSuccess: () => {
        if (result?.report.id === saved.id) setResult(null);
        list.retry();
      },
      onSettled: () => setRemoving(null),
    });

  return (
    <>
      <PagedItems
        list={list}
        skeletonRows={2}
        empty={{ compact: true, icon: <Bookmark />, title: 'Aún no guardas reportes', description: 'Guarda una respuesta del asistente o un reporte armado para volver a generarlo con los datos del día.' }}
        pager={{ variant: 'compact', noun: { one: 'reporte', other: 'reportes' } }}
      >
        {(items) => (
          <ul className={`log-list log-list--stacked saved-reports ${list.loading ? 'is-loading' : ''}`}>
            {items.map((saved) => (
              <li key={saved.id}>
                <strong>{saved.name}</strong>
                <small className="muted">
                  {saved.dataset_name} · generado {saved.runs} {saved.runs === 1 ? 'vez' : 'veces'}
                  {saved.last_run_at && ` · último ${timeAgo(saved.last_run_at)}`}
                </small>
                <span className="saved-reports__actions">
                  <Button size="sm" variant="secondary" icon={<Play size={16} />} loading={busy === `run-${saved.id}`} disabled={busy !== null} onClick={() => run(saved)}>
                    Generar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<FileSpreadsheet size={16} />}
                    loading={busy === `export-${saved.id}`}
                    disabled={busy !== null}
                    onClick={() => void report.exportPlan(saved.plan, null, saved.question, `export-${saved.id}`)}
                  >
                    Excel
                  </Button>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Borrar ${saved.name}`} disabled={busy !== null} onClick={() => setRemoving(saved)}>
                    <Trash2 size={16} />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PagedItems>
      {result && (
        <div className="saved-reports__result">
          <h3 className="saved-reports__title">{result.report.name}</h3>
          <AnswerCard
            answer={result.answer}
            actions={{ busy, onExport: () => void report.exportPlan(result.report.plan, null, result.report.question) }}
          />
        </div>
      )}
      <ConfirmDialog
        open={removing !== null}
        title="Borrar reporte guardado"
        message={`«${removing?.name ?? ''}» se quitará de tus reportes guardados. Los datos no se borran.`}
        confirmLabel="Borrar"
        tone="danger"
        loading={busy === 'delete'}
        onConfirm={() => remove(removing as SavedReport)}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
