import { Eye, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { useAction } from '../../hooks/useAction';
import { reportService } from '../../services/reportService';
import type { CatalogDataset, ReportAnswer, ReportCatalog } from '../../types';
import { FieldLabel } from '../FormField';
import { Button } from '../ui/Button';
import { DateField } from '../ui/DateField';
import { Select } from '../ui/Select';
import { AnswerCard } from './AnswerCard';
import { initialState, planFrom, type BuilderMode, type BuilderState } from './builderPlan';
import { useReportActions } from './useReportActions';

const NO_FILTER = '';

/** Armar un reporte paso a paso (sin escribir una pregunta): datos, forma, periodo y un filtro. */
export function ReportBuilder({ catalog, onSaved }: { catalog: ReportCatalog; onSaved: () => void }) {
  const [state, setState] = useState<BuilderState>(() => initialState(catalog.datasets[0]));
  const [result, setResult] = useState<ReportAnswer | null>(null);
  const preview = useAction<string>();
  const report = useReportActions(onSaved);
  const dataset = catalog.datasets.find((d) => d.code === state.dataset) as CatalogDataset;
  const plan = planFrom(state, dataset);
  const update = (changes: Partial<BuilderState>) => setState((current) => ({ ...current, ...changes }));
  const groupable = dataset.columns.filter((c) => c.group);
  const filterable = dataset.columns.filter((c) => c.options.length > 0);
  const filterColumn = filterable.find((c) => c.code === state.filterColumn);
  const modes: { value: BuilderMode; label: string }[] = [
    { value: 'rows', label: 'Detalle (una fila por registro)' },
    { value: 'count', label: 'Cuántos hay' },
    ...(groupable.length > 0 ? [{ value: 'groups' as const, label: 'Totales agrupados' }] : []),
  ];

  const show = () =>
    void preview.run(() => reportService.preview(plan), { busy: 'preview', errorTitle: 'No se pudo generar la vista previa', onSuccess: setResult });
  const busy = preview.busy ?? report.busy;
  const title = `${dataset.name} · ${new Date().toLocaleDateString('es-MX')}`;

  return (
    <div className="report-builder">
      <div className="report-builder__grid">
        <div className="field">
          <FieldLabel htmlFor="report-dataset" label="Datos" />
          <Select
            id="report-dataset"
            value={state.dataset}
            options={catalog.datasets.map((d) => ({ value: d.code, label: d.name }))}
            onChange={(code) => {
              setState(initialState(catalog.datasets.find((d) => d.code === code) as CatalogDataset));
              setResult(null);
            }}
          />
          <small className="muted">{dataset.description}</small>
        </div>
        <div className="field">
          <FieldLabel htmlFor="report-mode" label="Tipo de reporte" />
          <Select<BuilderMode> id="report-mode" value={state.mode} options={modes} onChange={(mode) => update({ mode })} />
        </div>
        {state.mode === 'groups' && (
          <div className="field">
            <FieldLabel htmlFor="report-group" label="Agrupar por" />
            <Select id="report-group" value={state.groupBy} options={groupable.map((c) => ({ value: c.code, label: c.label }))} onChange={(groupBy) => update({ groupBy })} />
          </div>
        )}
        {dataset.time && (
          <>
            <DateField label="Desde" value={state.from} max={state.to || undefined} onChange={(from) => update({ from })} />
            <DateField label="Hasta" value={state.to} min={state.from || undefined} onChange={(to) => update({ to })} />
          </>
        )}
        {filterable.length > 0 && (
          <div className="field">
            <FieldLabel htmlFor="report-filter" label="Filtrar por" />
            <Select
              id="report-filter"
              value={state.filterColumn}
              options={[{ value: NO_FILTER, label: 'Sin filtro' }, ...filterable.map((c) => ({ value: c.code, label: c.label }))]}
              onChange={(filterColumn) => update({ filterColumn, filterValue: '' })}
            />
          </div>
        )}
        {filterColumn && (
          <div className="field">
            <FieldLabel htmlFor="report-filter-value" label={filterColumn.label} />
            <Select
              id="report-filter-value"
              value={state.filterValue}
              placeholder="Elige un valor"
              options={filterColumn.options.map((o) => ({ value: String(o.value), label: o.label }))}
              onChange={(filterValue) => update({ filterValue })}
            />
          </div>
        )}
      </div>
      {state.mode === 'rows' && (
        <div className="report-builder__columns">
          <span className="report-builder__label">Columnas</span>
          <div className="chips">
            {dataset.columns.map((column) => {
              const active = state.columns.includes(column.code);
              return (
                <button
                  key={column.code}
                  type="button"
                  className={`chip ${active ? 'is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => update({ columns: active ? state.columns.filter((c) => c !== column.code) : [...state.columns, column.code] })}
                >
                  {column.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="report-builder__actions">
        <Button variant="secondary" icon={<Eye size={18} />} loading={busy === 'preview'} disabled={busy !== null} onClick={show}>
          Ver vista previa
        </Button>
        <Button variant="primary" icon={<FileSpreadsheet size={18} />} loading={busy === 'export'} disabled={busy !== null} onClick={() => void report.exportPlan(plan, null, null)}>
          Exportar a Excel
        </Button>
      </div>
      {result && (
        <AnswerCard
          answer={result}
          actions={{ busy, onExport: () => void report.exportPlan(plan, null, null), onSave: () => void report.save(title, plan, null, null) }}
        />
      )}
    </div>
  );
}
