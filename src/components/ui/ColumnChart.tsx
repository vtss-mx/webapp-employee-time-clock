import type { CSSProperties } from 'react';
import { useT } from '../../i18n';

/** Una serie de la gráfica: su nombre (leyenda y tabla) y su valor en cada categoría. */
export interface ColumnSeries<T> {
  key: string;
  label: string;
  value: (item: T) => number;
}

interface ColumnChartProps<T> {
  /** Qué muestra (nombre accesible de la gráfica y título de su tabla). */
  title: string;
  items: readonly T[];
  /** Clave y etiqueta corta de cada categoría (p. ej. el día: "4 oct"). */
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  /** Una serie (barras), dos (pares lado a lado, p. ej. datos que entran y que salen) o hasta tres líneas. */
  series: ReadonlyArray<ColumnSeries<T>>;
  /** Cómo se leen los valores (eje, globo y tabla). */
  format: (value: number) => string;
  /** Cuántas etiquetas del eje horizontal caben como máximo (las demás se omiten; la tabla las tiene todas). */
  maxTicks?: number;
  /** Qué es cada categoría: encabezado de la tabla y su nombre en el resumen (por omisión, días). */
  category?: { header: string; one: string; other: string };
  /**
   * Columnas (por omisión: cantidades por categoría) o líneas (una tendencia en el tiempo, p. ej. los tiempos
   * p50/p95/p99 de la latencia): mismo eje, globos, leyenda y tabla; cada serie es una línea de 2 px y su punto
   * aparece al pasar el cursor por la categoría.
   */
  variant?: 'columns' | 'lines';
  className?: string;
}

/** Proporción del valor respecto al máximo (0 cuando todo es cero). */
const ratio = (value: number, max: number) => (max > 0 ? Math.max(0, value) / max : 0);

/**
 * Las líneas de la variante `lines`: un SVG sobre las columnas con una unidad de ancho por categoría (el punto va
 * al centro de su columna) y 100 de alto; se estira al tamaño de la gráfica y el trazo no se deforma
 * (`vector-effect` en los estilos).
 */
function ChartLines<T>({ items, series, max }: { items: readonly T[]; series: ReadonlyArray<ColumnSeries<T>>; max: number }) {
  return (
    <svg className="column-chart__lines" viewBox={`0 0 ${items.length} 100`} preserveAspectRatio="none" aria-hidden>
      {series.map((s, position) => (
        <polyline key={s.key} className={`chart-stroke-${position + 1}`} points={items.map((item, index) => `${index + 0.5},${100 - ratio(s.value(item), max) * 100}`).join(' ')} />
      ))}
    </svg>
  );
}

/**
 * Gráfica de columnas propia (sin librerías): una columna por categoría, una barra por serie (con dos,
 * en pares lado a lado y leyenda) o, con `variant="lines"`, una línea por serie (hasta tres). Un solo eje vertical con su máximo, la mitad y el cero (líneas
 * tenues); al pasar el cursor, cada categoría muestra su globo con los valores. Para lectores de
 * pantalla la gráfica es una imagen con un resumen y debajo va su tabla completa (oculta a la vista).
 * Colores con los tokens `--chart-*`.
 */
export function ColumnChart<T>({ title, items, itemKey, itemLabel, series, format, maxTicks = 8, variant = 'columns', className = '', ...props }: ColumnChartProps<T>) {
  const t = useT();
  const category = props.category ?? { header: t('ui.columnChart.day.header'), one: t('ui.columnChart.day.one'), other: t('ui.columnChart.day.other') };
  const max = Math.max(0, ...items.flatMap((item) => series.map((s) => s.value(item))));
  const every = Math.max(1, Math.ceil(items.length / maxTicks));
  const noun = items.length === 1 ? category.one : category.other;
  let summary: string;
  if (variant === 'lines') {
    // Una tendencia no se suma: se dice dónde termina cada línea.
    const last = items.at(-1);
    const latest = series.map((s) => `${s.label}: ${format(last ? s.value(last) : 0)}`).join('; ');
    summary = t('ui.columnChart.latest', { title, count: items.length, items: noun, totals: latest, max: format(max) });
  } else {
    const totals = series.map((s) => `${s.label}: ${format(items.reduce((sum, item) => sum + s.value(item), 0))}`).join('; ');
    summary = t('ui.columnChart.summary', { title, count: items.length, items: noun, totals, item: category.one, max: format(max) });
  }

  return (
    <figure className={`column-chart column-chart--${variant} ${className}`.trim()}>
      {series.length > 1 && (
        <ul className="chart-legend" aria-hidden>
          {series.map((s, index) => (
            <li key={s.key}>
              <span className={`chart-legend__swatch chart-series-${index + 1}`} /> {s.label}
            </li>
          ))}
        </ul>
      )}
      <div className="column-chart__plot" role="img" aria-label={summary}>
        <div className="column-chart__axis" aria-hidden>
          <span>{format(max)}</span>
          <span>{format(max / 2)}</span>
          <span>{format(0)}</span>
        </div>
        <div className="column-chart__columns" style={{ '--columns': items.length } as CSSProperties}>
          {variant === 'lines' && <ChartLines items={items} series={series} max={max} />}
          {items.map((item, index) => (
            // El globo se alinea hacia adentro (a la izquierda en la mitad derecha): nunca sale de la gráfica.
            <div key={itemKey(item)} className={index >= items.length / 2 ? 'column-chart__column is-end' : 'column-chart__column'}>
              <div className="column-chart__bars">
                {series.map((s, position) => (
                  // Columnas: una barra por serie; líneas: el punto de cada serie en esa categoría.
                  <span key={s.key} className={`column-chart__${variant === 'lines' ? 'dot' : 'bar'} chart-series-${position + 1}`} style={{ '--value': ratio(s.value(item), max) } as CSSProperties} />
                ))}
              </div>
              <span className={`column-chart__tick ${index % every === 0 ? '' : 'is-hidden'}`.trim()}>{itemLabel(item)}</span>
              <span className="column-chart__tip">
                <strong>{itemLabel(item)}</strong>
                {series.map((s) => (
                  <span key={s.key}>
                    {s.label}: {format(s.value(item))}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">{category.header}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={itemKey(item)}>
              <th scope="row">{itemLabel(item)}</th>
              {series.map((s) => (
                <td key={s.key}>{format(s.value(item))}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
