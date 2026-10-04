import type { ReportPreview } from '../../types';

function cell(value: string | number | boolean | null): string {
  if (value === null) return '—';
  if (typeof value === 'number') return value.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value;
}

/** Vista previa de un reporte (las primeras filas o todos los grupos); el resto, en el Excel. */
export function ReportTable({ preview }: { preview: ReportPreview }) {
  const { columns, rows, total, truncated } = preview;
  return (
    <div className="report-table">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.code}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Las filas de una vista previa no tienen id: su posición es estable (no se reordenan). */}
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((column, j) => (
                  <td key={column.code} data-label={column.label} className={column.kind === 'number' ? 'is-number' : undefined}>
                    {cell(row[j])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="muted small">
          Mostrando {rows.length.toLocaleString('es-MX')} de {total.toLocaleString('es-MX')}. Exporta a Excel para tenerlos todos.
        </p>
      )}
    </div>
  );
}
